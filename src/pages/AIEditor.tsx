import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Globe, ArrowLeft, Sparkles, Loader2, Code2, Eye, Send, 
  Wand2, RefreshCw, Copy, Check, Download
} from 'lucide-react';
import { toast } from 'sonner';

interface Site {
  id: string;
  name: string;
  subdomain: string;
}

export default function AIEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSite();
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

  const saveToFile = async () => {
    if (!generatedCode || !site) return;

    setSaving(true);
    try {
      // Check if index.html exists
      const { data: existingFile } = await supabase
        .from('files')
        .select('id')
        .eq('site_id', site.id)
        .eq('name', 'index.html')
        .single();

      if (existingFile) {
        // Update existing file
        await supabase
          .from('files')
          .update({ content: generatedCode, size_bytes: new Blob([generatedCode]).size })
          .eq('id', existingFile.id);
      } else {
        // Create new file
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
                  Save to Site
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
          <div className="p-6 flex-1 flex flex-col">
            <h2 className="font-semibold mb-2 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              Describe Your Website
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Tell the AI what you want to create and it will generate the HTML for you.
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
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Start Over
                </Button>
              )}
            </div>
          </div>

          {/* Example prompts */}
          <div className="p-4 border-t border-border/50">
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
                <Textarea
                  value={generatedCode}
                  onChange={(e) => setGeneratedCode(e.target.value)}
                  className="absolute inset-0 resize-none rounded-none border-0 code-editor bg-background font-mono text-sm p-4 focus-visible:ring-0"
                />
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-3">AI-Powered HTML Builder</h2>
                <p className="text-muted-foreground">
                  Describe your website idea in natural language and let AI generate beautiful, 
                  responsive HTML code for you. No coding required!
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
