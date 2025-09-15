-- Update RLS policies to allow anonymous access to public tournaments

-- Temporarily disable RLS to update policies
ALTER TABLE public.tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.games DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with updated policies
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

-- Drop old policies that may be too restrictive
DROP POLICY IF EXISTS "tournaments_select_simple" ON public.tournaments;
DROP POLICY IF EXISTS "tournament_members_select_own" ON public.tournament_members;
DROP POLICY IF EXISTS "games_select" ON public.games;
DROP POLICY IF EXISTS "scores_select" ON public.scores;
DROP POLICY IF EXISTS "achievements_select" ON public.achievements;
DROP POLICY IF EXISTS "player_achievements_select" ON public.player_achievements;
DROP POLICY IF EXISTS "player_stats_select" ON public.player_stats;

-- Create new policies allowing anonymous access to public tournaments
CREATE POLICY "tournaments_select_anonymous"
  ON public.tournaments FOR SELECT
  USING (is_public = true OR auth.uid() IS NOT NULL);

CREATE POLICY "games_select_anonymous"
  ON public.games FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments
      WHERE is_public = true OR created_by = auth.uid()
    )
  );

CREATE POLICY "scores_select_anonymous"
  ON public.scores FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments
      WHERE is_public = true OR created_by = auth.uid()
    )
  );

CREATE POLICY "achievements_select_anonymous"
  ON public.achievements FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments
      WHERE is_public = true OR created_by = auth.uid()
    )
  );

CREATE POLICY "player_achievements_select_anonymous"
  ON public.player_achievements FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments
      WHERE is_public = true OR created_by = auth.uid()
    )
  );

CREATE POLICY "player_stats_select_anonymous"
  ON public.player_stats FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments
      WHERE is_public = true OR created_by = auth.uid()
    )
  );

-- Keep existing member policies for authenticated users
CREATE POLICY "tournament_members_select_authenticated"
  ON public.tournament_members FOR SELECT
  USING (user_id = auth.uid());

-- Verify policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('tournaments', 'games', 'scores', 'achievements')
ORDER BY tablename, policyname;
