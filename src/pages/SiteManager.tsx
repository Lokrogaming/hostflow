import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Globe, ArrowLeft, Plus, File, Folder, Trash2, Edit, Save, 
  ExternalLink, Github, Sparkles, Loader2, FileCode, FileText,
  Image, MoreVertical, Upload, X, Check
} from 'lucide-react';
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
import { toast } from 'sonner';

interface Site {
  id: string;
  name: string;
  subdomain: string;
  description: string | null;
  github_url: string | null;
  is_published: boolean;
}

interface SiteFile {
  id: string;
  name: string;
  path: string;
  content: string | null;
  file_type: string;
  size_bytes: number;
  created_at: string;
}

export default function SiteManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [site, setSite] = useState<Site | null>(null);
  const [files, setFiles] = useState<SiteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SiteFile | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingSite, setEditingSite] = useState(false);
  const [siteSettings, setSiteSettings] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchSite();
    fetchFiles();
  }, [id]);

  const fetchSite = async () => {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      toast.error('Site not found');
      navigate('/dashboard');
      return;
    }
    setSite(data);
    setSiteSettings({ name: data.name, description: data.description || '' });
  };

  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('site_id', id)
      .order('name');
    
    if (error) {
      toast.error('Failed to load files');
      return;
    }
    setFiles(data || []);
    setLoading(false);
  };

  const createFile = async () => {
    if (!newFileName.trim()) {
      toast.error('Please enter a file name');
      return;
    }

    const fileName = newFileName.endsWith('.html') ? newFileName : `${newFileName}.html`;
    
    const { data, error } = await supabase
      .from('files')
      .insert({
        site_id: id,
        name: fileName,
        path: `/${fileName}`,
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName.replace('.html', '')}</title>
    <style>
        body {
            font-family: system-ui, sans-serif;
            margin: 0;
            padding: 40px;
            background: #0a0a0b;
            color: #fff;
        }
    </style>
</head>
<body>
    <h1>Hello World</h1>
    <p>Start editing this file!</p>
</body>
</html>`,
        file_type: 'html',
        size_bytes: 0,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create file');
      return;
    }

    toast.success('File created');
    setFiles([...files, data]);
    setShowNewFile(false);
    setNewFileName('');
    setSelectedFile(data);
    setEditingContent(data.content || '');
  };

  const saveFile = async () => {
    if (!selectedFile) return;

    setSaving(true);
    const { error } = await supabase
      .from('files')
      .update({ 
        content: editingContent,
        size_bytes: new Blob([editingContent]).size,
      })
      .eq('id', selectedFile.id);

    if (error) {
      toast.error('Failed to save file');
    } else {
      toast.success('File saved');
      setFiles(files.map(f => f.id === selectedFile.id ? { ...f, content: editingContent } : f));
    }
    setSaving(false);
  };

  const deleteFile = async (fileId: string) => {
    const { error } = await supabase.from('files').delete().eq('id', fileId);
    if (error) {
      toast.error('Failed to delete file');
      return;
    }
    setFiles(files.filter(f => f.id !== fileId));
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
      setEditingContent('');
    }
    toast.success('File deleted');
  };

  const togglePublish = async () => {
    if (!site) return;
    const { error } = await supabase
      .from('sites')
      .update({ is_published: !site.is_published })
      .eq('id', site.id);

    if (error) {
      toast.error('Failed to update site');
      return;
    }
    setSite({ ...site, is_published: !site.is_published });
    toast.success(site.is_published ? 'Site unpublished' : 'Site published!');
  };

  const saveSiteSettings = async () => {
    if (!site) return;
    const { error } = await supabase
      .from('sites')
      .update({ name: siteSettings.name, description: siteSettings.description || null })
      .eq('id', site.id);

    if (error) {
      toast.error('Failed to save settings');
      return;
    }
    setSite({ ...site, ...siteSettings });
    setEditingSite(false);
    toast.success('Settings saved');
  };

  const importFromGithub = async () => {
    if (!githubUrl.trim()) {
      toast.error('Please enter a GitHub URL');
      return;
    }

    setImporting(true);
    // For now, we'll just store the GitHub URL
    // In a full implementation, you'd fetch files from the GitHub API
    const { error } = await supabase
      .from('sites')
      .update({ github_url: githubUrl })
      .eq('id', id);

    if (error) {
      toast.error('Failed to link GitHub');
    } else {
      toast.success('GitHub repository linked!');
      setSite(site ? { ...site, github_url: githubUrl } : null);
      setShowGithub(false);
      setGithubUrl('');
    }
    setImporting(false);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'html': return <FileCode className="w-4 h-4 text-orange-400" />;
      case 'css': return <FileCode className="w-4 h-4 text-blue-400" />;
      case 'js': return <FileCode className="w-4 h-4 text-yellow-400" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loading || !site) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-semibold">{site.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">{site.subdomain}.hostflow.app</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowGithub(true)}>
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/site/${id}/editor`}>
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">AI Builder</span>
              </Link>
            </Button>
            <Button 
              variant={site.is_published ? 'outline' : 'default'}
              size="sm" 
              onClick={togglePublish}
            >
              {site.is_published ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar - File list */}
        <aside className="w-64 border-r border-border/50 bg-card/30 flex flex-col">
          <div className="p-4 border-b border-border/50">
            <Button onClick={() => setShowNewFile(true)} size="sm" className="w-full">
              <Plus className="w-4 h-4" />
              New File
            </Button>
          </div>
          
          <div className="flex-1 overflow-auto p-2">
            {files.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8 px-4">
                No files yet. Create one or use the AI builder!
              </div>
            ) : (
              <div className="space-y-1">
                {files.map(file => (
                  <div
                    key={file.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors ${
                      selectedFile?.id === file.id ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'
                    }`}
                    onClick={() => {
                      setSelectedFile(file);
                      setEditingContent(file.content || '');
                    }}
                  >
                    {getFileIcon(file.file_type)}
                    <span className="flex-1 truncate text-sm">{file.name}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteFile(file.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Editor area */}
        <main className="flex-1 flex flex-col">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/30">
                <div className="flex items-center gap-2">
                  {getFileIcon(selectedFile.file_type)}
                  <span className="font-mono text-sm">{selectedFile.name}</span>
                </div>
                <Button onClick={saveFile} disabled={saving} size="sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </Button>
              </div>
              <div className="flex-1 relative">
                <Textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="absolute inset-0 resize-none rounded-none border-0 code-editor bg-background font-mono text-sm p-4 focus-visible:ring-0"
                  placeholder="Start typing your code..."
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a file to edit</p>
                <p className="text-sm mt-2">or create a new one</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* New file dialog */}
      <Dialog open={showNewFile} onOpenChange={setShowNewFile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>Enter a name for your new file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>File Name</Label>
              <Input
                placeholder="index.html"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createFile()}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowNewFile(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={createFile} className="flex-1">
                Create File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GitHub dialog */}
      <Dialog open={showGithub} onOpenChange={setShowGithub}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from GitHub</DialogTitle>
            <DialogDescription>
              Link a GitHub repository to import files
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Repository URL</Label>
              <Input
                placeholder="https://github.com/user/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the full URL to your GitHub repository
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowGithub(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={importFromGithub} disabled={importing} className="flex-1">
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Link Repository
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
