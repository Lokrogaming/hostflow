-- Drop existing trigger and recreate function to properly bypass RLS
DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;

-- Recreate the function with explicit RLS bypass by using ALTER TABLE TEMPORARILY
CREATE OR REPLACE FUNCTION public.add_workspace_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert with explicit bypass since we're using SECURITY DEFINER
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Member already exists, ignore
    RETURN NEW;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.add_workspace_owner() TO authenticated;

-- Recreate trigger
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.add_workspace_owner();

-- The real fix: Add a permissive policy for the trigger function to work
-- We need to allow the service role / definer context to insert

-- Alternative approach: Add a policy that allows inserting your own membership as owner
-- when you're the owner of the workspace being referenced
CREATE POLICY "Allow workspace owner to be added as first member"
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if the user is inserting themselves as owner of a workspace they own
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id
    AND w.owner_id = user_id
    AND user_id = auth.uid()
    AND role = 'owner'
  )
);