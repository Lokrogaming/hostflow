import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Loader2, Users, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function JoinWorkspace() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [invite, setInvite] = useState<{
    workspace_name?: string;
    role?: string;
    error?: string;
  } | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (token) {
      checkInvite();
    }
  }, [token]);

  const checkInvite = async () => {
    try {
      // Get invite details
      const { data, error } = await supabase
        .from('workspace_invites')
        .select(`
          id,
          role,
          is_active,
          expires_at,
          max_uses,
          uses,
          workspaces (name)
        `)
        .eq('token', token)
        .single();

      if (error || !data) {
        setInvite({ error: 'Invite not found' });
        setLoading(false);
        return;
      }

      // Check if invite is valid
      if (!data.is_active) {
        setInvite({ error: 'This invite has been deactivated' });
        setLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setInvite({ error: 'This invite has expired' });
        setLoading(false);
        return;
      }

      if (data.max_uses && data.uses >= data.max_uses) {
        setInvite({ error: 'This invite has reached its usage limit' });
        setLoading(false);
        return;
      }

      setInvite({
        workspace_name: (data.workspaces as any)?.name || 'Unknown Workspace',
        role: data.role,
      });
      setLoading(false);
    } catch (err) {
      console.error('Error checking invite:', err);
      setInvite({ error: 'Failed to load invite' });
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !token) return;

    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('join_workspace_via_invite', {
        invite_token: token,
      });

      if (error) {
        toast.error('Failed to join workspace');
        setResult({ success: false, message: error.message });
        setJoining(false);
        return;
      }

      const result = data as { success: boolean; error?: string; workspace_id?: string };
      
      if (result.success) {
        toast.success('Successfully joined workspace!');
        setResult({ success: true, message: 'You have successfully joined the workspace!' });
        setTimeout(() => {
          navigate('/workspaces');
        }, 2000);
      } else {
        setResult({ success: false, message: result.error || 'Failed to join' });
      }
    } catch (err: any) {
      toast.error('Failed to join workspace');
      setResult({ success: false, message: err.message });
    } finally {
      setJoining(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invite?.error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Invalid Invite</h1>
          <p className="text-muted-foreground mb-6">{invite.error}</p>
          <Button asChild>
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            result.success ? 'bg-green-500/20' : 'bg-destructive/20'
          }`}>
            {result.success ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 text-destructive" />
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {result.success ? 'Welcome!' : 'Failed to Join'}
          </h1>
          <p className="text-muted-foreground mb-6">{result.message}</p>
          <Button asChild>
            <Link to={result.success ? '/workspaces' : '/'}>
              {result.success ? 'Go to Workspaces' : 'Go Home'}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Join Workspace</h1>
          <p className="text-muted-foreground mb-2">
            You've been invited to join <strong>{invite?.workspace_name}</strong>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Please sign in or create an account to join this workspace.
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1">
              <Link to={`/login?redirect=/invite/${token}`}>Sign In</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to={`/signup?redirect=/invite/${token}`}>Sign Up</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Join Workspace</h1>
        <p className="text-muted-foreground mb-2">
          You've been invited to join <strong className="text-foreground">{invite?.workspace_name}</strong>
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          You'll join as <span className="capitalize text-primary">{invite?.role}</span>
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link to="/dashboard">Cancel</Link>
          </Button>
          <Button onClick={handleJoin} disabled={joining} className="flex-1">
            {joining && <Loader2 className="w-4 h-4 animate-spin" />}
            Join Workspace
          </Button>
        </div>
      </div>
    </div>
  );
}
