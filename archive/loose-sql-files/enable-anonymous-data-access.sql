-- Enable anonymous access to tournament data by updating RLS policies
-- This allows anonymous users to view games, scores, and achievements from public tournaments

-- First, ensure the default tournament is public
UPDATE public.tournaments
SET is_public = true
WHERE name = 'Default Arcade Tournament' OR slug = 'default-arcade';

-- Temporarily disable RLS on key tables to allow anonymous access
ALTER TABLE public.games DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with permissive policies
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "games_select" ON public.games;
DROP POLICY IF EXISTS "scores_select" ON public.scores;
DROP POLICY IF EXISTS "achievements_select" ON public.achievements;
DROP POLICY IF EXISTS "player_achievements_select" ON public.player_achievements;
DROP POLICY IF EXISTS "player_stats_select" ON public.player_stats;

-- Create permissive policies for anonymous access to public tournament data
CREATE POLICY "games_anonymous_access"
  ON public.games FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments WHERE is_public = true
    )
  );

CREATE POLICY "scores_anonymous_access"
  ON public.scores FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments WHERE is_public = true
    )
  );

CREATE POLICY "achievements_anonymous_access"
  ON public.achievements FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments WHERE is_public = true
    )
  );

CREATE POLICY "player_achievements_anonymous_access"
  ON public.player_achievements FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments WHERE is_public = true
    )
  );

CREATE POLICY "player_stats_anonymous_access"
  ON public.player_stats FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM public.tournaments WHERE is_public = true
    )
  );

-- Verify the policies are created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('games', 'scores', 'achievements', 'player_achievements', 'player_stats')
  AND policyname LIKE '%anonymous%'
ORDER BY tablename, policyname;
