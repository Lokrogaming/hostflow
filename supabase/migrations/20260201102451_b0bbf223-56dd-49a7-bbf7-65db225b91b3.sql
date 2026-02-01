-- Create workspaces table for team collaboration
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workspace members table with roles
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

CREATE TABLE public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role workspace_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Add workspace_id to sites table (nullable for backwards compatibility)
ALTER TABLE public.sites ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Create security definer functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(_workspace_id UUID, _user_id UUID)
RETURNS workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id
$$;

-- Workspaces policies
CREATE POLICY "Users can view workspaces they are members of" ON public.workspaces
  FOR SELECT USING (public.is_workspace_member(id, auth.uid()));

CREATE POLICY "Users can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Only owners can update workspaces" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Only owners can delete workspaces" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- Workspace members policies
CREATE POLICY "Members can view other members in their workspaces" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins can add members" ON public.workspace_members
  FOR INSERT WITH CHECK (
    public.get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "Owners and admins can update member roles" ON public.workspace_members
  FOR UPDATE USING (
    public.get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "Owners and admins can remove members" ON public.workspace_members
  FOR DELETE USING (
    public.get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
    OR user_id = auth.uid()
  );

-- Update sites policies to include workspace access
CREATE POLICY "Workspace members can view workspace sites" ON public.sites
  FOR SELECT USING (
    workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY "Workspace editors can update workspace sites" ON public.sites
  FOR UPDATE USING (
    workspace_id IS NOT NULL 
    AND public.get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin', 'editor')
  );

-- Update files policies to include workspace access
CREATE POLICY "Workspace members can view workspace site files" ON public.files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sites 
      WHERE sites.id = files.site_id 
      AND sites.workspace_id IS NOT NULL 
      AND public.is_workspace_member(sites.workspace_id, auth.uid())
    )
  );

CREATE POLICY "Workspace editors can create files in workspace sites" ON public.files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites 
      WHERE sites.id = files.site_id 
      AND sites.workspace_id IS NOT NULL 
      AND public.get_workspace_role(sites.workspace_id, auth.uid()) IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Workspace editors can update files in workspace sites" ON public.files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sites 
      WHERE sites.id = files.site_id 
      AND sites.workspace_id IS NOT NULL 
      AND public.get_workspace_role(sites.workspace_id, auth.uid()) IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Workspace editors can delete files from workspace sites" ON public.files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.sites 
      WHERE sites.id = files.site_id 
      AND sites.workspace_id IS NOT NULL 
      AND public.get_workspace_role(sites.workspace_id, auth.uid()) IN ('owner', 'admin', 'editor')
    )
  );

-- Create trigger to auto-add owner as workspace member
CREATE OR REPLACE FUNCTION public.add_workspace_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner();

-- Create trigger to update timestamps
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();