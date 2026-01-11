-- Restrict achievements visibility to tournament creators only
-- This ensures achievements are only visible to the user who created the tournament

-- Update the achievements RLS policy to only allow creators to view their achievements
DROP POLICY IF EXISTS "Users can view achievements in accessible tournaments" ON public.achievements;
DROP POLICY IF EXISTS "Tournament creators can view their achievements" ON public.achievements;

CREATE POLICY "Tournament creators can view their achievements" ON public.achievements
  FOR SELECT USING (
    created_by = auth.uid()
  );

-- Update player achievements policy to only allow viewing achievements from tournaments created by the user
DROP POLICY IF EXISTS "Users can view player achievements in accessible tournaments" ON public.player_achievements;
DROP POLICY IF EXISTS "Users can view player achievements in their tournaments" ON public.player_achievements;

CREATE POLICY "Users can view player achievements in their tournaments" ON public.player_achievements
  FOR SELECT USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  );

-- Keep the existing insert/update/delete policies for tournament admins
-- (These should remain as they allow proper achievement management)