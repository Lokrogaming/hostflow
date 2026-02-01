import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
  size: number;
}

interface ImportedFile {
  name: string;
  path: string;
  content: string;
  file_type: string;
  size_bytes: number;
}

async function fetchGitHubContents(owner: string, repo: string, path: string = ""): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const response = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "HostFlow-GitHub-Import",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Repository not found or is private");
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

async function fetchFileContent(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  return response.text();
}

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'js':
    case 'mjs':
      return 'js';
    case 'json':
      return 'json';
    case 'svg':
      return 'svg';
    case 'md':
      return 'md';
    default:
      return 'text';
  }
}

function isWebFile(filename: string): boolean {
  const webExtensions = ['html', 'htm', 'css', 'js', 'mjs', 'json', 'svg', 'md', 'txt'];
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? webExtensions.includes(ext) : false;
}

async function importDirectory(
  owner: string, 
  repo: string, 
  path: string,
  basePath: string = ""
): Promise<ImportedFile[]> {
  const files: ImportedFile[] = [];
  const contents = await fetchGitHubContents(owner, repo, path);

  for (const item of contents) {
    // Skip hidden files and common non-web directories
    if (item.name.startsWith('.') || 
        item.name === 'node_modules' || 
        item.name === 'package-lock.json' ||
        item.name === 'yarn.lock') {
      continue;
    }

    if (item.type === 'dir') {
      // Recursively fetch directory contents (limit depth to prevent too deep recursion)
      const depth = path.split('/').filter(Boolean).length;
      if (depth < 3) {
        const subFiles = await importDirectory(owner, repo, item.path, basePath);
        files.push(...subFiles);
      }
    } else if (item.type === 'file' && item.download_url && isWebFile(item.name)) {
      try {
        const content = await fetchFileContent(item.download_url);
        const relativePath = basePath 
          ? `/${item.path.replace(basePath, '').replace(/^\//, '')}`
          : `/${item.path}`;
        
        files.push({
          name: item.name,
          path: relativePath.startsWith('/') ? relativePath : `/${relativePath}`,
          content,
          file_type: getFileType(item.name),
          size_bytes: item.size,
        });
      } catch (error) {
        console.error(`Failed to fetch ${item.path}:`, error);
      }
    }
  }

  return files;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { github_url, subfolder } = await req.json();

    if (!github_url) {
      return new Response(
        JSON.stringify({ error: "GitHub URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse GitHub URL
    // Supports: 
    // - https://github.com/owner/repo
    // - https://github.com/owner/repo/tree/branch/path
    // - github.com/owner/repo
    let url = github_url.trim();
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    const githubRegex = /github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/[^\/]+\/(.*))?/;
    const match = url.match(githubRegex);

    if (!match) {
      return new Response(
        JSON.stringify({ error: "Invalid GitHub URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const owner = match[1];
    const repo = match[2].replace('.git', '');
    const pathFromUrl = match[3] || subfolder || "";

    console.log(`Importing from ${owner}/${repo}${pathFromUrl ? `/${pathFromUrl}` : ''}`);

    const files = await importDirectory(owner, repo, pathFromUrl, pathFromUrl);

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No web files found in repository" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully imported ${files.length} files`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        files,
        message: `Imported ${files.length} files from ${owner}/${repo}` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("GitHub import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to import from GitHub" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
