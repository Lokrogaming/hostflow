import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Globe, Zap, Github, Sparkles, ArrowRight, Code2, Layers } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text">HostFlow</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button variant="hero" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-slow" />
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-secondary/50 backdrop-blur-sm mb-8 animate-fade-in">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">AI-Powered Website Builder</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight animate-fade-in" style={{ animationDelay: '100ms' }}>
              Host websites with{' '}
              <span className="gradient-text">zero friction</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '200ms' }}>
              Build, deploy, and manage your HTML sites in seconds. Import from GitHub or create with our AI builder. No server setup required.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '300ms' }}>
              <Link to="/signup">
                <Button variant="hero" size="xl" className="w-full sm:w-auto">
                  Start Building Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="glass" size="xl" className="w-full sm:w-auto">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>

          {/* Preview mockup */}
          <div className="mt-20 relative animate-fade-in" style={{ animationDelay: '400ms' }}>
            <div className="glass-card p-2 max-w-5xl mx-auto glow-primary">
              <div className="bg-card rounded-lg overflow-hidden">
                <div className="h-8 bg-secondary/50 flex items-center gap-2 px-4 border-b border-border/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-warning/60" />
                    <div className="w-3 h-3 rounded-full bg-success/60" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 rounded-md bg-background/50 text-xs text-muted-foreground font-mono">
                      yoursite.hostflow.app
                    </div>
                  </div>
                </div>
                <div className="h-80 bg-gradient-to-br from-secondary/30 to-background flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Code2 className="w-16 h-16 text-primary mx-auto animate-float" />
                    <p className="text-muted-foreground">Your site preview here</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to host</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Powerful features that make web hosting simple and enjoyable
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Instant Deploy"
              description="Upload your files and they're live instantly. No build steps, no waiting."
            />
            <FeatureCard
              icon={<Github className="w-6 h-6" />}
              title="GitHub Import"
              description="Connect your repository and deploy directly from your GitHub projects."
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="AI Builder"
              description="Describe what you want and let AI generate beautiful HTML for you."
            />
            <FeatureCard
              icon={<Globe className="w-6 h-6" />}
              title="Custom Domains"
              description="Get your own subdomain or connect a custom domain."
            />
            <FeatureCard
              icon={<Code2 className="w-6 h-6" />}
              title="Code Editor"
              description="Built-in editor with syntax highlighting and live preview."
            />
            <FeatureCard
              icon={<Layers className="w-6 h-6" />}
              title="File Management"
              description="Organize your files and assets with an intuitive file manager."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-6 relative">
          <div className="glass-card p-12 max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to launch?</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join thousands of developers who trust HostFlow for their web projects.
            </p>
            <Link to="/signup">
              <Button variant="hero" size="xl">
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
          © 2026 HostFlow. Built with Lovable.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass-card p-6 hover:border-primary/30 transition-colors group">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
