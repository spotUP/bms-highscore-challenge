-- Update all RLS policies for tournament isolation
-- This migration updates existing RLS policies to include tournament scoping

-- Helper function to check if user can access tournament data
CREATE OR REPLACE FUNCTION public.can_access_tournament_data(tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  tournament_public BOOLEAN;
BEGIN
  -- Check if tournament is public
  SELECT is_public INTO tournament_public 
  FROM public.tournaments 
  WHERE id = tournament_id AND is_active = true;
  
  -- If tournament is public, allow access
  IF tournament_public = true THEN
    RETURN true;
  END IF;
  
  -- Check if user is a member of the tournament
  RETURN EXISTS (
    SELECT 1 FROM public.tournament_members 
    WHERE tournament_members.tournament_id = can_access_tournament_data.tournament_id 
    AND user_id = auth.uid() 
    AND is_active = true
  );
END;
$$;

-- Drop existing policies and create new tournament-scoped ones

-- GAMES TABLE POLICIES
DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;
DROP POLICY IF EXISTS "Admins can create games" ON public.games;
DROP POLICY IF EXISTS "Admins can update games" ON public.games;
DROP POLICY IF EXISTS "Admins can delete games" ON public.games;

CREATE POLICY "Users can view games in accessible tournaments" ON public.games
  FOR SELECT USING (can_access_tournament_data(tournament_id));

CREATE POLICY "Tournament admins can create games" ON public.games
  FOR INSERT WITH CHECK (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

CREATE POLICY "Tournament admins can update games" ON public.games
  FOR UPDATE USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

CREATE POLICY "Tournament admins can delete games" ON public.games
  FOR DELETE USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

-- SCORES TABLE POLICIES
DROP POLICY IF EXISTS "Scores are viewable by everyone" ON public.scores;
DROP POLICY IF EXISTS "Admins can create scores" ON public.scores;
DROP POLICY IF EXISTS "Admins can update scores" ON public.scores;
DROP POLICY IF EXISTS "Admins can delete scores" ON public.scores;

CREATE POLICY "Users can view scores in accessible tournaments" ON public.scores
  FOR SELECT USING (can_access_tournament_data(tournament_id));

CREATE POLICY "Tournament members can create scores" ON public.scores
  FOR INSERT WITH CHECK (
    has_tournament_permission(tournament_id, auth.uid(), 'player')
  );

CREATE POLICY "Tournament admins can update scores" ON public.scores
  FOR UPDATE USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

CREATE POLICY "Tournament admins can delete scores" ON public.scores
  FOR DELETE USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

-- ACHIEVEMENTS TABLE POLICIES
DROP POLICY IF EXISTS "Anyone can view achievements" ON public.achievements;
DROP POLICY IF EXISTS "Only admins can manage achievements" ON public.achievements;

CREATE POLICY "Users can view achievements in accessible tournaments" ON public.achievements
  FOR SELECT USING (can_access_tournament_data(tournament_id));

CREATE POLICY "Tournament admins can manage achievements" ON public.achievements
  FOR ALL USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

-- PLAYER ACHIEVEMENTS TABLE POLICIES
DROP POLICY IF EXISTS "Anyone can view player achievements" ON public.player_achievements;
DROP POLICY IF EXISTS "System can insert player achievements" ON public.player_achievements;

CREATE POLICY "Users can view player achievements in accessible tournaments" ON public.player_achievements
  FOR SELECT USING (can_access_tournament_data(tournament_id));

CREATE POLICY "Tournament members can earn achievements" ON public.player_achievements
  FOR INSERT WITH CHECK (
    has_tournament_permission(tournament_id, auth.uid(), 'player')
  );

CREATE POLICY "Tournament admins can manage player achievements" ON public.player_achievements
  FOR UPDATE USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

CREATE POLICY "Tournament admins can delete player achievements" ON public.player_achievements
  FOR DELETE USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

-- PLAYER STATS TABLE POLICIES
DROP POLICY IF EXISTS "Anyone can view player stats" ON public.player_stats;

CREATE POLICY "Users can view player stats in accessible tournaments" ON public.player_stats
  FOR SELECT USING (can_access_tournament_data(tournament_id));

CREATE POLICY "System can update player stats" ON public.player_stats
  FOR ALL WITH CHECK (true);

-- COMPETITION HISTORY TABLE POLICIES
DROP POLICY IF EXISTS "Only admins can manage competition history" ON public.competition_history;

CREATE POLICY "Users can view competition history in accessible tournaments" ON public.competition_history
  FOR SELECT USING (can_access_tournament_data(tournament_id));

CREATE POLICY "Tournament admins can manage competition history" ON public.competition_history
  FOR ALL USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

-- COMPETITION GAMES TABLE POLICIES
DROP POLICY IF EXISTS "Only admins can manage competition games" ON public.competition_games;

CREATE POLICY "Users can view competition games in accessible tournaments" ON public.competition_games
  FOR SELECT USING (
    can_access_tournament_data(tournament_id)
  );

CREATE POLICY "Tournament admins can manage competition games" ON public.competition_games
  FOR ALL USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

-- COMPETITION SCORES TABLE POLICIES
DROP POLICY IF EXISTS "Only admins can manage competition scores" ON public.competition_scores;

CREATE POLICY "Users can view competition scores in accessible tournaments" ON public.competition_scores
  FOR SELECT USING (
    can_access_tournament_data(tournament_id)
  );

CREATE POLICY "Tournament admins can manage competition scores" ON public.competition_scores
  FOR ALL USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

-- COMPETITION PLAYERS TABLE POLICIES
DROP POLICY IF EXISTS "Only admins can manage competition players" ON public.competition_players;

CREATE POLICY "Users can view competition players in accessible tournaments" ON public.competition_players
  FOR SELECT USING (
    can_access_tournament_data(tournament_id)
  );

CREATE POLICY "Tournament admins can manage competition players" ON public.competition_players
  FOR ALL USING (
    has_tournament_permission(tournament_id, auth.uid(), 'admin')
  );

-- Grant execute permission on the new function
GRANT EXECUTE ON FUNCTION public.can_access_tournament_data(UUID) TO authenticated;
