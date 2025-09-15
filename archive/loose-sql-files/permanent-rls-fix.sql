-- Permanent RLS Fix: Create proper non-recursive policies
-- Run this AFTER the temp fix works

-- Step 1: Re-enable RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_invitations ENABLE ROW LEVEL SECURITY;

-- Step 2: Create simple, non-recursive policies
-- tournaments: allow select if public, owned, or user is a direct member
CREATE POLICY "tournaments_select_simple"
  ON public.tournaments FOR SELECT
  USING (
    is_public = true
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tournament_members tm
      WHERE tm.tournament_id = tournaments.id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
    )
  );

-- tournaments: allow insert for authenticated users
CREATE POLICY "tournaments_insert"
  ON public.tournaments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- tournaments: allow update for owners only
CREATE POLICY "tournaments_update"
  ON public.tournaments FOR UPDATE
  USING (created_by = auth.uid());

-- tournaments: allow delete for owners only
CREATE POLICY "tournaments_delete"
  ON public.tournaments FOR DELETE
  USING (created_by = auth.uid());

-- tournament_members: allow select for user's own memberships
CREATE POLICY "tournament_members_select_own"
  ON public.tournament_members FOR SELECT
  USING (user_id = auth.uid());

-- tournament_members: allow insert for user's own memberships only
CREATE POLICY "tournament_members_insert_own"
  ON public.tournament_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- tournament_members: allow update for user's own memberships only
CREATE POLICY "tournament_members_update_own"
  ON public.tournament_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- tournament_members: allow delete for user's own memberships only
CREATE POLICY "tournament_members_delete_own"
  ON public.tournament_members FOR DELETE
  USING (user_id = auth.uid());

-- Step 3: Verify policies work
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('tournaments', 'tournament_members')
ORDER BY tablename, policyname;
