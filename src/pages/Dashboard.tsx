import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Globe, Plus, Search, ExternalLink, Settings, LogOut, 
  MoreVertical, Trash2, Edit, Github, Sparkles, Loader2, FolderOpen, Users
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Site {
  id: string;
  name: string;
  subdomain: string;
  description: string | null;
  github_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewSite, setShowNewSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteSubdomain, setNewSiteSubdomain] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSites(data || []);
    } catch (error: any) {
      toast.error('Failed to load sites');
    } finally {
      setLoading(false);
    }
  };

  const createSite = async () => {
    if (!newSiteName.trim() || !newSiteSubdomain.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('sites')
        .insert({
          name: newSiteName,
          subdomain: newSiteSubdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
          user_id: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Site created!');
      setShowNewSite(false);
      setNewSiteName('');
      setNewSiteSubdomain('');
      navigate(`/site/${data.id}`);
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('This subdomain is already taken');
      } else {
        toast.error(error.message || 'Failed to create site');
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteSite = async (id: string) => {
    try {
      const { error } = await supabase.from('sites').delete().eq('id', id);
      if (error) throw error;
      setSites(sites.filter(s => s.id !== id));
      toast.success('Site deleted');
    } catch (error: any) {
      toast.error('Failed to delete site');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const filteredSites = sites.filter(site => 
    site.name.toLowerCase().includes(search.toLowerCase()) ||
    site.subdomain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text">HostFlow</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/workspaces">
                <Users className="w-4 h-4" />
                Workspaces
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-8">
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search sites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setShowNewSite(true)} variant="hero">
            <Plus className="w-4 h-4" />
            New Site
          </Button>
        </div>

        {/* Sites grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
              <Globe className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {search ? 'No sites found' : 'No sites yet'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {search ? 'Try a different search term' : 'Create your first website to get started'}
            </p>
            {!search && (
              <Button onClick={() => setShowNewSite(true)} variant="hero">
                <Plus className="w-4 h-4" />
                Create Your First Site
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSites.map(site => (
              <SiteCard key={site.id} site={site} onDelete={() => deleteSite(site.id)} />
            ))}
          </div>
        )}
      </main>

      {/* New site dialog */}
      <Dialog open={showNewSite} onOpenChange={setShowNewSite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Site</DialogTitle>
            <DialogDescription>
              Give your site a name and choose a subdomain
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">Site Name</Label>
              <Input
                id="siteName"
                placeholder="My Awesome Site"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <div className="flex items-center">
                <Input
                  id="subdomain"
                  placeholder="my-site"
                  value={newSiteSubdomain}
                  onChange={(e) => setNewSiteSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="rounded-r-none"
                />
                <span className="px-3 h-10 flex items-center bg-secondary border border-l-0 border-input rounded-r-md text-sm text-muted-foreground">
                  .hostflow.app
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowNewSite(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={createSite} disabled={creating} className="flex-1">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Site
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SiteCard({ site, onDelete }: { site: Site; onDelete: () => void }) {
  return (
    <div className="glass-card p-5 group hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/site/${site.id}`}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Link to={`/site/${site.id}`}>
        <h3 className="font-semibold mb-1 hover:text-primary transition-colors">{site.name}</h3>
      </Link>
      <p className="text-sm text-muted-foreground mb-4 font-mono">htmlhoster.lovable.app/sites/{site.subdomain}</p>

      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded-full ${site.is_published ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
          {site.is_published ? 'Published' : 'Draft'}
        </span>
        {site.github_url && (
          <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground flex items-center gap-1">
            <Github className="w-3 h-3" />
            GitHub
          </span>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border/50 flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to={`/site/${site.id}`}>
            <FolderOpen className="w-3 h-3" />
            Files
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to={`/site/${site.id}/editor`}>
            <Sparkles className="w-3 h-3" />
            AI Builder
          </Link>
        </Button>
      </div>
    </div>
  );
}
