-- Fix RLS policy infinite recursion using SECURITY DEFINER helpers
-- This replaces recursive cross-table references with helper functions

-- 1) Create helper function: check if current user is a member of a tournament
CREATE OR REPLACE FUNCTION public.user_is_member(p_tournament_id uuid, p_roles tournament_role[] DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_member boolean;
BEGIN
  IF p_roles IS NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.tournament_members tm
      WHERE tm.tournament_id = p_tournament_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
    ) INTO is_member;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.tournament_members tm
      WHERE tm.tournament_id = p_tournament_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role = ANY(p_roles)
    ) INTO is_member;
  END IF;
  RETURN is_member;
END;
$$;

-- Grant execute on helper to authenticated users
GRANT EXECUTE ON FUNCTION public.user_is_member(uuid, tournament_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_member(uuid) TO authenticated;

-- 2) Drop existing policies that may recurse
DROP POLICY IF EXISTS "Users can view tournaments they are members of" ON public.tournaments;
DROP POLICY IF EXISTS "Users can view public tournaments or owned tournaments" ON public.tournaments;

DROP POLICY IF EXISTS "Users can view tournament members for their tournaments" ON public.tournament_members;
DROP POLICY IF EXISTS "Tournament owners and admins can manage members" ON public.tournament_members;
DROP POLICY IF EXISTS "Users can view their own tournament memberships" ON public.tournament_members;
DROP POLICY IF EXISTS "Users can create their own memberships" ON public.tournament_members;
DROP POLICY IF EXISTS "Users can update their own memberships" ON public.tournament_members;
DROP POLICY IF EXISTS "Tournament owners can manage all memberships" ON public.tournament_members;

-- 3) Recreate NON-RECURSIVE policies
-- tournaments: allow select if public, owned, or user is member (via helper)
CREATE POLICY "tournaments_select"
  ON public.tournaments FOR SELECT
  USING (
    is_public = true
    OR created_by = auth.uid()
    OR public.user_is_member(id)
  );

-- tournament_members: users can select rows they own or when owner/admin of that tournament
CREATE POLICY "tournament_members_select"
  ON public.tournament_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.user_is_member(tournament_id, ARRAY['owner','admin']::tournament_role[])
  );

-- Insert membership: allow user to create their own row only
CREATE POLICY "tournament_members_insert"
  ON public.tournament_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Update membership: allow user to update their own row, or owners/admins to manage any
CREATE POLICY "tournament_members_update"
  ON public.tournament_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.user_is_member(tournament_id, ARRAY['owner','admin']::tournament_role[])
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.user_is_member(tournament_id, ARRAY['owner','admin']::tournament_role[])
  );

-- Delete membership: only owners/admins of the tournament
CREATE POLICY "tournament_members_delete"
  ON public.tournament_members FOR DELETE
  USING (public.user_is_member(tournament_id, ARRAY['owner','admin']::tournament_role[]));

-- 4) Fix the webhook_config table RLS policies
ALTER TABLE webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage webhook config" 
ON webhook_config FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);