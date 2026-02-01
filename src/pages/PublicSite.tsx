import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function PublicSite() {
  const { subdomain, '*': filePath } = useParams();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSiteContent();
  }, [subdomain, filePath]);

  const fetchSiteContent = async () => {
    if (!subdomain) {
      setError('Site not found');
      setLoading(false);
      return;
    }

    try {
      // First, get the site by subdomain
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('id, is_published')
        .eq('subdomain', subdomain)
        .single();

      if (siteError || !site) {
        setError('Site not found');
        setLoading(false);
        return;
      }

      if (!site.is_published) {
        setError('This site is not published');
        setLoading(false);
        return;
      }

      // Determine which file to load
      let targetPath = filePath ? `/${filePath}` : '/index.html';
      if (!targetPath.includes('.')) {
        targetPath = targetPath.endsWith('/') ? `${targetPath}index.html` : `${targetPath}/index.html`;
      }

      // Normalize path
      targetPath = targetPath.replace(/\/+/g, '/');

      // Get the file content
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('content, file_type, name')
        .eq('site_id', site.id)
        .eq('path', targetPath)
        .single();

      if (fileError || !file) {
        // Try index.html if specific file not found
        if (targetPath !== '/index.html') {
          const { data: indexFile } = await supabase
            .from('files')
            .select('content, file_type')
            .eq('site_id', site.id)
            .eq('path', '/index.html')
            .single();

          if (indexFile) {
            setContent(indexFile.content || '');
            setLoading(false);
            return;
          }
        }
        setError('File not found');
        setLoading(false);
        return;
      }

      // Handle different file types
      if (file.file_type === 'css') {
        // Return CSS with proper content type
        document.head.innerHTML = `<style>${file.content || ''}</style>`;
        setContent('');
      } else if (file.file_type === 'js' || file.file_type === 'javascript') {
        // Return JS
        const script = document.createElement('script');
        script.textContent = file.content || '';
        document.body.appendChild(script);
        setContent('');
      } else {
        // HTML content
        setContent(file.content || '');
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching site:', err);
      setError('Failed to load site');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <a 
            href="/" 
            className="text-primary hover:underline"
          >
            Go to HostFlow
          </a>
        </div>
      </div>
    );
  }

  // Render the HTML content in an iframe for proper isolation
  return (
    <iframe
      srcDoc={content || ''}
      className="w-full h-screen border-0"
      title="Site Preview"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
