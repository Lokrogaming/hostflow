-- Create workspace invite links table
CREATE TABLE public.workspace_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  role workspace_role NOT NULL DEFAULT 'editor',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Policies for workspace invites
CREATE POLICY "Members can view invites for their workspaces" ON public.workspace_invites
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can create invites" ON public.workspace_invites
  FOR INSERT WITH CHECK (
    public.get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update invites" ON public.workspace_invites
  FOR UPDATE USING (
    public.get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete invites" ON public.workspace_invites
  FOR DELETE USING (
    public.get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
  );

-- Anyone can read invite by token (for joining)
CREATE POLICY "Anyone can view invite by token" ON public.workspace_invites
  FOR SELECT USING (true);

-- Create function to join workspace via invite
CREATE OR REPLACE FUNCTION public.join_workspace_via_invite(invite_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
  result JSON;
BEGIN
  -- Get the invite
  SELECT * INTO invite_record
  FROM public.workspace_invites
  WHERE token = invite_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses < max_uses);
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invite link');
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = invite_record.workspace_id 
    AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are already a member of this workspace');
  END IF;
  
  -- Add user to workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (invite_record.workspace_id, auth.uid(), invite_record.role, invite_record.created_by);
  
  -- Increment uses
  UPDATE public.workspace_invites SET uses = uses + 1 WHERE id = invite_record.id;
  
  RETURN json_build_object('success', true, 'workspace_id', invite_record.workspace_id);
END;
$$;

-- Enable realtime for presence tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;