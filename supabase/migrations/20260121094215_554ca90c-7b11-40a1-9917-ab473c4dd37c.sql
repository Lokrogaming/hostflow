
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sites table for hosted websites
CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  description TEXT,
  github_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create files table for site files
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT,
  file_type TEXT NOT NULL DEFAULT 'html',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sites policies
CREATE POLICY "Users can view their own sites" ON public.sites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own sites" ON public.sites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sites" ON public.sites FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sites" ON public.sites FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view published sites" ON public.sites FOR SELECT USING (is_published = true);

-- Files policies
CREATE POLICY "Users can view files of their sites" ON public.files FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = files.site_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can create files in their sites" ON public.files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = files.site_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can update files in their sites" ON public.files FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = files.site_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Users can delete files from their sites" ON public.files FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = files.site_id AND sites.user_id = auth.uid())
);
CREATE POLICY "Anyone can view files of published sites" ON public.files FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sites WHERE sites.id = files.site_id AND sites.is_published = true)
);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
