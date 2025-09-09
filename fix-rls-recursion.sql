-- Fix RLS policy infinite recursion issue
-- The problem is that tournament_members policies reference themselves

-- First, drop the problematic policies on tournament_members
DROP POLICY IF EXISTS "Users can view tournament members for their tournaments" ON tournament_members;
DROP POLICY IF EXISTS "Tournament owners and admins can manage members" ON tournament_members;

-- Create simpler, non-recursive policies for tournament_members
-- Allow users to see their own memberships
CREATE POLICY "Users can view their own tournament memberships"
  ON tournament_members FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to insert their own memberships (for joining tournaments)
CREATE POLICY "Users can create their own memberships"
  ON tournament_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to update their own memberships
CREATE POLICY "Users can update their own memberships" 
  ON tournament_members FOR UPDATE
  USING (user_id = auth.uid());

-- Allow tournament owners to manage memberships (non-recursive)
CREATE POLICY "Tournament owners can manage all memberships"
  ON tournament_members FOR ALL
  USING (
    tournament_id IN (
      SELECT t.id FROM tournaments t
      WHERE t.created_by = auth.uid()
    )
  );

-- Also fix the tournaments policies to be simpler
DROP POLICY IF EXISTS "Users can view tournaments they are members of" ON tournaments;

-- Create a simpler tournaments policy
CREATE POLICY "Users can view public tournaments or owned tournaments"
  ON tournaments FOR SELECT
  USING (
    is_public = true 
    OR created_by = auth.uid()
    OR id IN (
      SELECT tm.tournament_id 
      FROM tournament_members tm 
      WHERE tm.user_id = auth.uid() AND tm.is_active = true
    )
  );

-- Verify the policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('tournaments', 'tournament_members')
ORDER BY tablename, policyname;
