import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, Users, Settings, Trash2, MoreVertical, 
  Loader2, ArrowLeft, UserPlus, Crown, Shield, Edit, Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joined_at: string;
  profiles?: {
    email: string | null;
    display_name: string | null;
  };
}

export default function Workspaces() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [creating, setCreating] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load workspaces');
      return;
    }
    setWorkspaces(data || []);
    setLoading(false);
  };

  const fetchMembers = async (workspaceId: string) => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        profiles:user_id (email, display_name)
      `)
      .eq('workspace_id', workspaceId);

    if (error) {
      toast.error('Failed to load members');
      return;
    }
    setMembers(data as any || []);
  };

  const createWorkspace = async () => {
    if (!newWorkspace.name.trim()) {
      toast.error('Please enter a workspace name');
      return;
    }

    setCreating(true);
    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        name: newWorkspace.name,
        description: newWorkspace.description || null,
        owner_id: user?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create workspace');
      setCreating(false);
      return;
    }

    setWorkspaces([data, ...workspaces]);
    setShowCreate(false);
    setNewWorkspace({ name: '', description: '' });
    setCreating(false);
    toast.success('Workspace created!');
  };

  const deleteWorkspace = async (id: string) => {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete workspace');
      return;
    }

    setWorkspaces(workspaces.filter(w => w.id !== id));
    toast.success('Workspace deleted');
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !showMembers) {
      toast.error('Please enter an email address');
      return;
    }

    setInviting(true);

    // Find user by email in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', inviteEmail.toLowerCase())
      .single();

    if (profileError || !profile) {
      toast.error('User not found. They must sign up first.');
      setInviting(false);
      return;
    }

    // Add member to workspace
    const { error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: showMembers,
        user_id: profile.user_id,
        role: inviteRole,
        invited_by: user?.id,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('User is already a member');
      } else {
        toast.error('Failed to invite member');
      }
      setInviting(false);
      return;
    }

    toast.success('Member invited!');
    setInviteEmail('');
    setShowInvite(false);
    setInviting(false);
    fetchMembers(showMembers);
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      toast.error('Failed to remove member');
      return;
    }

    setMembers(members.filter(m => m.id !== memberId));
    toast.success('Member removed');
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-primary" />;
      case 'editor': return <Edit className="w-4 h-4 text-green-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="font-semibold">Workspaces</span>
            </div>
          </div>

          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Workspace
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {workspaces.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">No workspaces yet</h2>
            <p className="text-muted-foreground mb-6">
              Create a workspace to collaborate with your team
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Create Workspace
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="glass-card p-6 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{workspace.name}</h3>
                      {workspace.owner_id === user?.id && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Owner
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setShowMembers(workspace.id);
                        fetchMembers(workspace.id);
                      }}>
                        <Users className="w-4 h-4 mr-2" />
                        Manage Members
                      </DropdownMenuItem>
                      {workspace.owner_id === user?.id && (
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteWorkspace(workspace.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {workspace.description && (
                  <p className="text-sm text-muted-foreground">{workspace.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Workspace Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Create a shared workspace to collaborate with your team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Workspace Name</Label>
              <Input
                placeholder="My Team"
                value={newWorkspace.name}
                onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What is this workspace for?"
                value={newWorkspace.description}
                onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={createWorkspace} disabled={creating} className="flex-1">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={!!showMembers} onOpenChange={() => setShowMembers(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Workspace Members</DialogTitle>
            <DialogDescription>
              Manage who has access to this workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Button onClick={() => setShowInvite(true)} className="w-full">
              <UserPlus className="w-4 h-4" />
              Invite Member
            </Button>

            <div className="space-y-2 max-h-[300px] overflow-auto">
              {members.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    {getRoleIcon(member.role)}
                    <div>
                      <p className="text-sm font-medium">
                        {member.profiles?.display_name || member.profiles?.email || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                    </div>
                  </div>
                  {member.role !== 'owner' && member.user_id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeMember(member.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Invite someone to join this workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['admin', 'editor', 'viewer'] as const).map((role) => (
                  <Button
                    key={role}
                    variant={inviteRole === role ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInviteRole(role)}
                    className="capitalize"
                  >
                    {role}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {inviteRole === 'admin' && 'Can manage members and all sites'}
                {inviteRole === 'editor' && 'Can edit sites and files'}
                {inviteRole === 'viewer' && 'Can only view sites and files'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowInvite(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={inviteMember} disabled={inviting} className="flex-1">
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                Invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
