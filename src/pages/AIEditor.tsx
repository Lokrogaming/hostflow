import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CodeEditor from '@/components/CodeEditor';
import { 
  ArrowLeft, Sparkles, Loader2, Code2, Eye, 
  Wand2, RefreshCw, Copy, Check, Download, 
  FileCode, FolderPlus, Trash2, Edit, Plus
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';

interface Site {
  id: string;
  name: string;
  subdomain: string;
}

interface SiteFile {
  id: string;
  name: string;
  path: string;
  content: string | null;
  file_type: string;
}

type AIAction = 'generate' | 'edit' | 'create-file' | 'delete-file';

export default function AIEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const [site, setSite] = useState<Site | null>(null);
  const [files, setFiles] = useState<SiteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'files'>('generate');
  
  // File operation states
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'html' | 'css' | 'js'>('html');
  const [newFilePath, setNewFilePath] = useState('/');
  const [selectedFile, setSelectedFile] = useState<SiteFile | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  useEffect(() => {
    fetchSite();
    fetchFiles();
  }, [id]);

  const fetchSite = async () => {
    const { data, error } = await supabase
      .from('sites')
      .select('id, name, subdomain')
      .eq('id', id)
      .single();
    
    if (error) {
      toast.error('Site not found');
      return;
    }
    setSite(data);
    setLoading(false);
  };

  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from('files')
      .select('id, name, path, content, file_type')
      .eq('site_id', id)
      .order('path');
    
    if (error) {
      console.error('Failed to fetch files:', error);
      return;
    }
    setFiles(data || []);
  };

  const generateHTML = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe what you want to create');
      return;
    }

    setGenerating(true);
    setGeneratedCode('');

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-html`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
          return;
        }
        throw new Error('Failed to generate HTML');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setGeneratedCode(fullContent);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (!fullContent) {
        toast.error('No content generated');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate HTML');
    } finally {
      setGenerating(false);
    }
  };

  const editFileWithAI = async () => {
    if (!editPrompt.trim() || !selectedFile) {
      toast.error('Please describe what changes you want');
      return;
    }

    setGenerating(true);
    setGeneratedCode('');

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-html`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          prompt: `Edit the following ${selectedFile.file_type.toUpperCase()} code based on these instructions: ${editPrompt}

Current code:
\`\`\`${selectedFile.file_type}
${selectedFile.content}
\`\`\`

Return ONLY the modified code, nothing else.`,
          mode: 'edit'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit file');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setGeneratedCode(fullContent);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (fullContent) {
        toast.success('File edited! Review and save the changes.');
      }
    } catch (error: any) {
      console.error('Edit error:', error);
      toast.error(error.message || 'Failed to edit file');
    } finally {
      setGenerating(false);
    }
  };

  const createFileWithAI = async () => {
    if (!prompt.trim() || !newFileName.trim()) {
      toast.error('Please enter a file name and description');
      return;
    }

    setGenerating(true);

    try {
      const ext = newFileType === 'html' ? '.html' : newFileType === 'css' ? '.css' : '.js';
      const fileName = newFileName.endsWith(ext) ? newFileName : `${newFileName}${ext}`;
      const filePath = newFilePath === '/' ? `/${fileName}` : `${newFilePath}/${fileName}`;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-html`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          prompt: `Create a ${newFileType.toUpperCase()} file with the following requirements: ${prompt}

${newFileType === 'html' ? 'Return complete, valid HTML with embedded CSS styles.' : ''}
${newFileType === 'css' ? 'Return clean, organized CSS with comments.' : ''}
${newFileType === 'js' ? 'Return clean, modern JavaScript code with comments.' : ''}

Return ONLY the code, nothing else.`,
          fileType: newFileType
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate file');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (fullContent) {
        // Save the file
        const { data, error } = await supabase
          .from('files')
          .insert({
            site_id: id,
            name: fileName,
            path: filePath,
            content: fullContent,
            file_type: newFileType,
            size_bytes: new Blob([fullContent]).size,
          })
          .select()
          .single();

        if (error) {
          toast.error('Failed to save file');
          return;
        }

        setFiles([...files, data]);
        setShowCreateFile(false);
        setNewFileName('');
        setPrompt('');
        toast.success(`Created ${fileName}!`);
      }
    } catch (error: any) {
      console.error('Create error:', error);
      toast.error(error.message || 'Failed to create file');
    } finally {
      setGenerating(false);
    }
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
    }
    toast.success('File deleted');
  };

  const saveToFile = async () => {
    if (!generatedCode || !site) return;

    setSaving(true);
    try {
      if (selectedFile) {
        // Update existing file
        await supabase
          .from('files')
          .update({ content: generatedCode, size_bytes: new Blob([generatedCode]).size })
          .eq('id', selectedFile.id);
        
        setFiles(files.map(f => f.id === selectedFile.id ? { ...f, content: generatedCode } : f));
        toast.success(`Saved to ${selectedFile.name}!`);
      } else {
        // Check if index.html exists
        const { data: existingFile } = await supabase
          .from('files')
          .select('id')
          .eq('site_id', site.id)
          .eq('name', 'index.html')
          .single();

        if (existingFile) {
          await supabase
            .from('files')
            .update({ content: generatedCode, size_bytes: new Blob([generatedCode]).size })
            .eq('id', existingFile.id);
        } else {
          await supabase.from('files').insert({
            site_id: site.id,
            name: 'index.html',
            path: '/index.html',
            content: generatedCode,
            file_type: 'html',
            size_bytes: new Blob([generatedCode]).size,
          });
        }
        toast.success('Saved to index.html!');
      }
      await fetchFiles();
    } catch (error: any) {
      toast.error('Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'html': return <FileCode className="w-4 h-4 text-orange-400" />;
      case 'css': return <FileCode className="w-4 h-4 text-blue-400" />;
      case 'js': return <FileCode className="w-4 h-4 text-yellow-400" />;
      default: return <FileCode className="w-4 h-4 text-muted-foreground" />;
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
            <Link to={`/site/${id}`} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold">AI Builder</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{site.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {generatedCode && (
              <>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? <Code2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? 'Code' : 'Preview'}
                </Button>
                <Button onClick={saveToFile} disabled={saving} size="sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {selectedFile ? `Save to ${selectedFile.name}` : 'Save to Site'}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Left - Prompt panel */}
        <aside className="w-96 border-r border-border/50 bg-card/30 flex flex-col">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-4">
              <TabsTrigger value="generate" className="flex-1">Generate</TabsTrigger>
              <TabsTrigger value="files" className="flex-1">Manage Files</TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="flex-1 flex flex-col p-4">
              <h2 className="font-semibold mb-2 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                Describe Your Website
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Tell the AI what you want to create and it will generate the code for you.
              </p>
              
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Create a modern landing page for a tech startup with a hero section, features grid, and contact form. Use a dark theme with cyan accents..."
                className="flex-1 min-h-[200px] resize-none"
              />

              <div className="mt-4 space-y-3">
                <Button 
                  onClick={generateHTML} 
                  disabled={generating || !prompt.trim()} 
                  variant="hero"
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate HTML
                    </>
                  )}
                </Button>

                {generatedCode && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setPrompt('');
                      setGeneratedCode('');
                      setSelectedFile(null);
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Start Over
                  </Button>
                )}
              </div>

              {/* Example prompts */}
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Try these examples:</p>
                <div className="space-y-2">
                  {[
                    'Personal portfolio with dark theme',
                    'Restaurant menu page with images',
                    'Coming soon page with countdown',
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setPrompt(example)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-primary" />
                  Site Files
                </h2>
                <Button size="sm" onClick={() => setShowCreateFile(true)}>
                  <Plus className="w-4 h-4" />
                  Create
                </Button>
              </div>

              <div className="flex-1 overflow-auto space-y-2">
                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No files yet. Create one with AI!
                  </p>
                ) : (
                  files.map((file) => (
                    <div
                      key={file.id}
                      className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedFile?.id === file.id ? 'bg-primary/10 border border-primary/50' : 'bg-secondary/50 hover:bg-secondary'
                      }`}
                      onClick={() => {
                        setSelectedFile(file);
                        setGeneratedCode(file.content || '');
                      }}
                    >
                      {getFileIcon(file.file_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{file.path}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFile(file.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {selectedFile && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Edit className="w-4 h-4 text-primary" />
                    Edit with AI
                  </h3>
                  <Textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Describe what changes you want..."
                    className="min-h-[80px] resize-none mb-2"
                  />
                  <Button 
                    onClick={editFileWithAI} 
                    disabled={generating || !editPrompt.trim()}
                    className="w-full"
                    size="sm"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Apply Changes
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </aside>

        {/* Right - Code/Preview area */}
        <main className="flex-1 flex flex-col">
          {generatedCode ? (
            showPreview ? (
              <iframe
                srcDoc={generatedCode}
                className="flex-1 w-full bg-white"
                title="Preview"
              />
            ) : (
              <div className="flex-1 relative">
                <CodeEditor
                  value={generatedCode}
                  onChange={setGeneratedCode}
                  language={selectedFile?.file_type as 'html' | 'css' | 'js' || 'html'}
                />
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-3">AI-Powered Code Builder</h2>
                <p className="text-muted-foreground">
                  Generate HTML, CSS, and JavaScript with AI. Create new files, 
                  edit existing ones, or let AI build your entire site.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create File Dialog */}
      <Dialog open={showCreateFile} onOpenChange={setShowCreateFile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create File with AI</DialogTitle>
            <DialogDescription>
              Describe what you want and AI will generate the file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
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
                  placeholder="page.html"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Path (optional)</Label>
              <Input
                placeholder="/"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Describe the file</Label>
              <Textarea
                placeholder="A stylesheet for the homepage with modern design..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCreateFile(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={createFileWithAI} disabled={generating} className="flex-1">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Create with AI
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
