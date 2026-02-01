import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CodeEditor from '@/components/CodeEditor';
import { 
  Globe, ArrowLeft, Plus, File, Folder, Trash2, Save, 
  ExternalLink, Github, Sparkles, Loader2, FileCode, FileText,
  MoreVertical, X, Eye, Code, Columns, FolderPlus, ChevronRight, ChevronDown
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Site {
  id: string;
  name: string;
  subdomain: string;
  description: string | null;
  github_url: string | null;
  is_published: boolean;
  user_id: string;
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

interface FolderNode {
  name: string;
  path: string;
  children: (FolderNode | SiteFile)[];
  isFolder: true;
}

export default function SiteManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [site, setSite] = useState<Site | null>(null);
  const [files, setFiles] = useState<SiteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'html' | 'css' | 'js'>('html');
  const [newFolderName, setNewFolderName] = useState('');
  const [currentFolder, setCurrentFolder] = useState('/');
  const [githubUrl, setGithubUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SiteFile | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'preview' | 'split'>('split');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [isOwner, setIsOwner] = useState(false);

  // Debounced preview content for performance
  const [previewContent, setPreviewContent] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewContent(editingContent);
    }, 300);
    return () => clearTimeout(timer);
  }, [editingContent]);

  // Generate preview HTML with proper base styling
  const previewHtml = useMemo(() => {
    if (!previewContent) return '';
    if (!selectedFile) return '';
    
    // For CSS files, show in a styled preview
    if (selectedFile.file_type === 'css') {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${previewContent}</style>
</head>
<body>
  <div style="padding: 20px; font-family: system-ui;">
    <h1>CSS Preview</h1>
    <p>This is a sample paragraph to preview your styles.</p>
    <button>Sample Button</button>
    <a href="#">Sample Link</a>
    <div class="container">
      <div class="box">Box 1</div>
      <div class="box">Box 2</div>
      <div class="box">Box 3</div>
    </div>
  </div>
</body>
</html>`;
    }
    
    // For JS files, show in a console-like preview
    if (selectedFile.file_type === 'js' || selectedFile.file_type === 'javascript') {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff; }
    #output { white-space: pre-wrap; }
    .log { color: #0ff; }
    .error { color: #f55; }
  </style>
</head>
<body>
  <h3>JavaScript Console Output:</h3>
  <div id="output"></div>
  <script>
    const output = document.getElementById('output');
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => {
      output.innerHTML += '<div class="log">' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ') + '</div>';
      originalLog(...args);
    };
    console.error = (...args) => {
      output.innerHTML += '<div class="error">' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ') + '</div>';
      originalError(...args);
    };
    try {
      ${previewContent}
    } catch(e) {
      console.error('Error:', e.message);
    }
  </script>
</body>
</html>`;
    }
    
    // If it's already a full HTML document, use it as-is
    if (previewContent.toLowerCase().includes('<!doctype') || previewContent.toLowerCase().includes('<html')) {
      return previewContent;
    }
    
    // Otherwise, wrap it in a basic HTML structure
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
  </style>
</head>
<body>
${previewContent}
</body>
</html>`;
  }, [previewContent, selectedFile?.file_type]);

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
    setIsOwner(data.user_id === user?.id);
  };

  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('site_id', id)
      .order('path');
    
    if (error) {
      toast.error('Failed to load files');
      return;
    }
    setFiles(data || []);
    setLoading(false);
  };

  // Build folder tree structure
  const fileTree = useMemo(() => {
    const root: FolderNode = { name: '/', path: '/', children: [], isFolder: true };
    const folderMap = new Map<string, FolderNode>();
    folderMap.set('/', root);

    // Extract unique folders from file paths
    const folders = new Set<string>();
    files.forEach(file => {
      const parts = file.path.split('/').filter(Boolean);
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += '/' + parts[i];
        folders.add(currentPath);
      }
    });

    // Create folder nodes
    Array.from(folders).sort().forEach(folderPath => {
      const parts = folderPath.split('/').filter(Boolean);
      const name = parts[parts.length - 1];
      const parentPath = '/' + parts.slice(0, -1).join('/') || '/';
      
      const folderNode: FolderNode = { name, path: folderPath, children: [], isFolder: true };
      folderMap.set(folderPath, folderNode);
      
      const parent = folderMap.get(parentPath === '/' ? '/' : parentPath);
      if (parent) {
        parent.children.push(folderNode);
      }
    });

    // Add files to their parent folders
    files.forEach(file => {
      const parts = file.path.split('/').filter(Boolean);
      const parentPath = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/';
      const parent = folderMap.get(parentPath);
      if (parent) {
        parent.children.push(file);
      }
    });

    return root;
  }, [files]);

  const getFileExtension = (type: string): string => {
    switch (type) {
      case 'html': return '.html';
      case 'css': return '.css';
      case 'js': return '.js';
      case 'javascript': return '.js';
      default: return '.html';
    }
  };

  const createFile = async () => {
    if (!newFileName.trim()) {
      toast.error('Please enter a file name');
      return;
    }

    const ext = getFileExtension(newFileType);
    const fileName = newFileName.endsWith(ext) ? newFileName : `${newFileName}${ext}`;
    const filePath = currentFolder === '/' ? `/${fileName}` : `${currentFolder}/${fileName}`;
    
    const defaultContent = {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName.replace(ext, '')}</title>
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
      css: `/* ${fileName} */

body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #0a0a0b;
    color: #ffffff;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

h1, h2, h3 {
    font-weight: 600;
}

a {
    color: #00d4ff;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}
`,
      js: `// ${fileName}

// Your JavaScript code here
console.log('Hello from ${fileName}!');

// Example function
function greet(name) {
    return \`Hello, \${name}!\`;
}

// Example event listener
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
});
`,
    };
    
    const { data, error } = await supabase
      .from('files')
      .insert({
        site_id: id,
        name: fileName,
        path: filePath,
        content: defaultContent[newFileType],
        file_type: newFileType,
        size_bytes: new Blob([defaultContent[newFileType]]).size,
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
    setNewFileType('html');
    setSelectedFile(data);
    setEditingContent(data.content || '');
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    // Folders are virtual - we just create a placeholder file
    const folderPath = currentFolder === '/' 
      ? `/${newFolderName}` 
      : `${currentFolder}/${newFolderName}`;
    
    // Create an index.html in the new folder
    const { data, error } = await supabase
      .from('files')
      .insert({
        site_id: id,
        name: 'index.html',
        path: `${folderPath}/index.html`,
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${newFolderName}</title>
</head>
<body>
    <h1>${newFolderName}</h1>
</body>
</html>`,
        file_type: 'html',
        size_bytes: 0,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create folder');
      return;
    }

    toast.success('Folder created');
    setFiles([...files, data]);
    setShowNewFolder(false);
    setNewFolderName('');
    setExpandedFolders(new Set([...expandedFolders, folderPath]));
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

  const deleteFolder = async (folderPath: string) => {
    // Delete all files in this folder
    const folderFiles = files.filter(f => f.path.startsWith(folderPath + '/'));
    
    for (const file of folderFiles) {
      await supabase.from('files').delete().eq('id', file.id);
    }
    
    setFiles(files.filter(f => !f.path.startsWith(folderPath + '/')));
    toast.success('Folder deleted');
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

  const importFromGithub = async () => {
    if (!githubUrl.trim()) {
      toast.error('Please enter a GitHub URL');
      return;
    }

    setImporting(true);
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
      case 'js': 
      case 'javascript': return <FileCode className="w-4 h-4 text-yellow-400" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (node: FolderNode | SiteFile, depth = 0): JSX.Element[] => {
    const items: JSX.Element[] = [];
    
    if ('isFolder' in node && node.isFolder) {
      const isExpanded = expandedFolders.has(node.path);
      const isRoot = node.path === '/';
      
      if (!isRoot) {
        items.push(
          <div
            key={`folder-${node.path}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-secondary group"
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Folder className="w-4 h-4 text-primary" />
            <span className="flex-1 truncate text-sm">{node.name}</span>
            {isOwner && (
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
                  <DropdownMenuItem onClick={() => {
                    setCurrentFolder(node.path);
                    setShowNewFile(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    New File
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => deleteFolder(node.path)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      }
      
      if (isExpanded || isRoot) {
        // Sort children: folders first, then files
        const sortedChildren = [...node.children].sort((a, b) => {
          const aIsFolder = 'isFolder' in a;
          const bIsFolder = 'isFolder' in b;
          if (aIsFolder && !bIsFolder) return -1;
          if (!aIsFolder && bIsFolder) return 1;
          return ('name' in a ? a.name : '') .localeCompare('name' in b ? b.name : '');
        });
        
        sortedChildren.forEach(child => {
          items.push(...renderFileTree(child, isRoot ? depth : depth + 1));
        });
      }
    } else {
      // It's a file
      const file = node as SiteFile;
      items.push(
        <div
          key={file.id}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors ${
            selectedFile?.id === file.id ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => {
            setSelectedFile(file);
            setEditingContent(file.content || '');
          }}
        >
          {getFileIcon(file.file_type)}
          <span className="flex-1 truncate text-sm">{file.name}</span>
          {isOwner && (
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
          )}
        </div>
      );
    }
    
    return items;
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
              <p className="text-xs text-muted-foreground font-mono">
                {site.is_published && (
                  <a 
                    href={`/sites/${site.subdomain}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-primary"
                  >
                    htmlhoster.lovable.app/sites/{site.subdomain}
                  </a>
                )}
                {!site.is_published && `htmlhoster.lovable.app/sites/${site.subdomain}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {site.is_published && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/sites/${site.subdomain}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">View Site</span>
                </a>
              </Button>
            )}
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
            {isOwner && (
              <Button 
                variant={site.is_published ? 'outline' : 'default'}
                size="sm" 
                onClick={togglePublish}
              >
                {site.is_published ? 'Unpublish' : 'Publish'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar - File list */}
        <aside className="w-64 border-r border-border/50 bg-card/30 flex flex-col">
          {isOwner && (
            <div className="p-4 border-b border-border/50 flex gap-2">
              <Button onClick={() => { setCurrentFolder('/'); setShowNewFile(true); }} size="sm" className="flex-1">
                <Plus className="w-4 h-4" />
                File
              </Button>
              <Button onClick={() => { setCurrentFolder('/'); setShowNewFolder(true); }} size="sm" variant="outline">
                <FolderPlus className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <div className="flex-1 overflow-auto p-2">
            {files.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8 px-4">
                No files yet. Create one or use the AI builder!
              </div>
            ) : (
              <div className="space-y-1">
                {renderFileTree(fileTree)}
              </div>
            )}
          </div>
        </aside>

        {/* Editor area */}
        <main className="flex-1 flex flex-col min-w-0">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/30">
                <div className="flex items-center gap-2">
                  {getFileIcon(selectedFile.file_type)}
                  <span className="font-mono text-sm">{selectedFile.path}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as typeof viewMode)}>
                    <ToggleGroupItem value="code" aria-label="Code only" className="h-8 px-3">
                      <Code className="w-4 h-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="split" aria-label="Split view" className="h-8 px-3">
                      <Columns className="w-4 h-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="preview" aria-label="Preview only" className="h-8 px-3">
                      <Eye className="w-4 h-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {isOwner && (
                    <Button onClick={saveFile} disabled={saving} size="sm">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 flex min-h-0">
                {/* Code Editor */}
                {(viewMode === 'code' || viewMode === 'split') && (
                  <div className={`flex-1 relative ${viewMode === 'split' ? 'border-r border-border/50' : ''}`}>
                    <CodeEditor
                      value={editingContent}
                      onChange={setEditingContent}
                      language={selectedFile.file_type as 'html' | 'css' | 'js' | 'text'}
                      readOnly={!isOwner}
                    />
                  </div>
                )}
                {/* Live Preview */}
                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div className="flex-1 flex flex-col">
                    <div className="px-4 py-2 border-b border-border/50 bg-card/50 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Live Preview</span>
                      <div className="flex-1" />
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                    <div className="flex-1 bg-white">
                      <iframe
                        srcDoc={previewHtml}
                        className="w-full h-full border-0"
                        title="Live Preview"
                        sandbox="allow-scripts allow-same-origin"
                      />
                    </div>
                  </div>
                )}
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
            <DialogDescription>
              Create a new file in {currentFolder === '/' ? 'root' : currentFolder}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>File Type</Label>
              <Select value={newFileType} onValueChange={(v) => setNewFileType(v as typeof newFileType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="css">CSS</SelectItem>
                  <SelectItem value="js">JavaScript</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>File Name</Label>
              <Input
                placeholder={newFileType === 'html' ? 'index.html' : newFileType === 'css' ? 'styles.css' : 'script.js'}
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

      {/* New folder dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder in {currentFolder === '/' ? 'root' : currentFolder}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                placeholder="components"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowNewFolder(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={createFolder} className="flex-1">
                Create Folder
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
