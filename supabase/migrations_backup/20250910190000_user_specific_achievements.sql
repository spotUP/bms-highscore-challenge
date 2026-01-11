-- Make achievements user-specific within tournaments
-- This migration connects achievements to authenticated users rather than just player names

-- First, add user_id to player_achievements and player_stats tables
ALTER TABLE public.player_achievements ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.player_stats ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for the new user_id columns
CREATE INDEX idx_player_achievements_user ON public.player_achievements(user_id);
CREATE INDEX idx_player_stats_user ON public.player_stats(user_id);
CREATE INDEX idx_player_achievements_tournament_user ON public.player_achievements(tournament_id, user_id);
CREATE INDEX idx_player_stats_tournament_user ON public.player_stats(tournament_id, user_id);

-- Update the unique constraint on player_achievements to include user_id and tournament_id
-- This allows the same user to get the same achievement in different tournaments
ALTER TABLE public.player_achievements DROP CONSTRAINT IF EXISTS player_achievements_unique_constraint;
ALTER TABLE public.player_achievements ADD CONSTRAINT player_achievements_user_tournament_unique 
  UNIQUE (user_id, achievement_id, tournament_id);

-- Update player_stats to have unique constraint per user per tournament
ALTER TABLE public.player_stats DROP CONSTRAINT IF EXISTS player_stats_pkey;
ALTER TABLE public.player_stats DROP CONSTRAINT IF EXISTS player_stats_player_name_key;
ALTER TABLE public.player_stats ADD CONSTRAINT player_stats_user_tournament_unique 
  UNIQUE (user_id, tournament_id);

-- Create updated function to check and award achievements with user context
CREATE OR REPLACE FUNCTION check_and_award_achievements_for_user(
  p_user_id UUID,
  p_player_name TEXT,
  p_tournament_id UUID,
  p_game_id UUID,
  p_score INTEGER,
  p_is_first_place BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  player_stat_record RECORD;
  new_achievements JSON := '[]'::json;
  achievement_count INTEGER := 0;
BEGIN
  -- Only proceed if we have a valid user_id (authenticated user)
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User must be authenticated to earn achievements',
      'new_achievements', '[]'::json,
      'achievement_count', 0
    );
  END IF;

  -- Get or create player stats for this user in this tournament
  INSERT INTO player_stats (
    user_id, 
    player_name, 
    tournament_id, 
    total_scores, 
    total_games_played, 
    first_place_count, 
    total_score, 
    best_score, 
    last_score_date
  )
  VALUES (
    p_user_id, 
    p_player_name, 
    p_tournament_id, 
    1, 
    1, 
    CASE WHEN p_is_first_place THEN 1 ELSE 0 END, 
    p_score, 
    p_score, 
    NOW()
  )
  ON CONFLICT (user_id, tournament_id) DO UPDATE SET
    total_scores = player_stats.total_scores + 1,
    total_games_played = player_stats.total_games_played + 1,
    first_place_count = player_stats.first_place_count + CASE WHEN p_is_first_place THEN 1 ELSE 0 END,
    total_score = player_stats.total_score + p_score,
    best_score = GREATEST(player_stats.best_score, p_score),
    last_score_date = NOW(),
    updated_at = NOW()
  RETURNING * INTO player_stat_record;

  -- Check for achievements that this user hasn't earned in this tournament yet
  FOR achievement_record IN 
    SELECT * FROM achievements 
    WHERE is_active = true 
    AND tournament_id = p_tournament_id
    AND id NOT IN (
      SELECT achievement_id FROM player_achievements 
      WHERE user_id = p_user_id 
      AND tournament_id = p_tournament_id
    )
  LOOP
    DECLARE
      should_award BOOLEAN := false;
    BEGIN
      -- Check achievement criteria based on type
      CASE achievement_record.type
        WHEN 'first_score' THEN
          should_award := player_stat_record.total_scores = 1;
          
        WHEN 'first_place' THEN
          should_award := p_is_first_place;
          
        WHEN 'score_milestone' THEN
          should_award := p_score >= (achievement_record.criteria->>'min_score')::INTEGER;
          
        WHEN 'game_master' THEN
          should_award := player_stat_record.total_games_played >= (achievement_record.criteria->>'game_count')::INTEGER;
          
        WHEN 'high_scorer' THEN
          should_award := p_score >= (achievement_record.criteria->>'min_score')::INTEGER;
          
        WHEN 'consistent_player' THEN
          should_award := player_stat_record.total_scores >= (achievement_record.criteria->>'min_scores')::INTEGER;
          
        ELSE
          should_award := false;
      END CASE;

      -- Award achievement if criteria met
      IF should_award THEN
        INSERT INTO player_achievements (
          user_id,
          player_name, 
          achievement_id, 
          tournament_id,
          game_id, 
          score, 
          metadata
        )
        VALUES (
          p_user_id,
          p_player_name, 
          achievement_record.id, 
          p_tournament_id,
          p_game_id, 
          p_score,
          jsonb_build_object(
            'unlocked_via', achievement_record.type,
            'criteria_met', achievement_record.criteria
          )
        );
        
        new_achievements := new_achievements || jsonb_build_object(
          'id', achievement_record.id,
          'name', achievement_record.name,
          'description', achievement_record.description,
          'badge_icon', achievement_record.badge_icon,
          'badge_color', achievement_record.badge_color,
          'points', achievement_record.points
        );
        
        achievement_count := achievement_count + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'new_achievements', new_achievements,
    'achievement_count', achievement_count,
    'player_stats', row_to_json(player_stat_record)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create updated trigger function that gets user context from scores table
CREATE OR REPLACE FUNCTION trigger_achievement_check_for_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_place BOOLEAN := false;
  result JSON;
  score_user_id UUID;
BEGIN
  -- Get the user_id from the score record (assuming scores table has user_id)
  -- If scores table doesn't have user_id, we'll need to get it from tournament membership
  -- Do NOT directly reference NEW.user_id, because the scores table may not have this column.
  -- Safely attempt to read a user_id from NEW via JSON, which won't error if the column is missing.
  BEGIN
    score_user_id := (to_jsonb(NEW)->>'user_id')::uuid;
  EXCEPTION WHEN others THEN
    score_user_id := NULL;
  END;
  
  -- If no user_id in scores table, try to get it from current auth context
  IF score_user_id IS NULL THEN
    score_user_id := auth.uid();
  END IF;
  
  -- Only proceed if we have a user (authenticated users only get achievements)
  IF score_user_id IS NOT NULL THEN
    -- Check if this is a first place score within this tournament
    SELECT NOT EXISTS(
      SELECT 1 FROM scores 
      WHERE game_id = NEW.game_id 
      AND tournament_id = NEW.tournament_id
      AND score > NEW.score
    ) INTO is_first_place;

    -- Check and award achievements for this specific user in this tournament
    SELECT check_and_award_achievements_for_user(
      score_user_id,
      NEW.player_name,
      NEW.tournament_id,
      NEW.game_id,
      NEW.score,
      is_first_place
    ) INTO result;

    -- Log achievement unlocks (optional)
    IF (result->>'achievement_count')::INTEGER > 0 THEN
      RAISE NOTICE 'User % (player %) unlocked % achievements in tournament %', 
        score_user_id, NEW.player_name, result->>'achievement_count', NEW.tournament_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger
DROP TRIGGER IF EXISTS achievement_check_trigger ON scores;
CREATE TRIGGER achievement_check_trigger
  AFTER INSERT OR UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_check_for_user();

-- Create updated RPC function to get recent achievements for a specific user in a tournament
CREATE OR REPLACE FUNCTION get_recent_achievements_for_user(
    p_user_id UUID,
    p_tournament_id UUID,
    p_since_minutes INTEGER DEFAULT 1
)
RETURNS TABLE (
    achievement_id UUID,
    achievement_name TEXT,
    achievement_description TEXT,
    badge_icon TEXT,
    badge_color TEXT,
    points INTEGER,
    unlocked_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as achievement_id,
        a.name as achievement_name,
        a.description as achievement_description,
        a.badge_icon,
        a.badge_color,
        a.points,
        pa.unlocked_at
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.user_id = p_user_id
    AND pa.tournament_id = p_tournament_id
    AND pa.unlocked_at >= NOW() - (p_since_minutes || ' minutes')::INTERVAL
    ORDER BY pa.unlocked_at DESC;
END;
$$;

-- Update RLS policies to be user-aware
DROP POLICY IF EXISTS "Anyone can view player achievements" ON player_achievements;
DROP POLICY IF EXISTS "Anyone can view player stats" ON player_stats;

-- Users can view their own achievements and stats, plus public tournament data
CREATE POLICY "Users can view achievements in accessible tournaments" ON player_achievements
  FOR SELECT USING (
    -- User can see their own achievements
    user_id = auth.uid() 
    OR 
    -- Or achievements in public tournaments
    tournament_id IN (
      SELECT id FROM tournaments WHERE is_public = true
    )
    OR
    -- Or achievements in tournaments they're a member of
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view stats in accessible tournaments" ON player_stats
  FOR SELECT USING (
    -- User can see their own stats
    user_id = auth.uid() 
    OR 
    -- Or stats in public tournaments
    tournament_id IN (
      SELECT id FROM tournaments WHERE is_public = true
    )
    OR
    -- Or stats in tournaments they're a member of
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- System can still insert/update for triggers
CREATE POLICY "System can manage user achievements" ON player_achievements
  FOR ALL WITH CHECK (true);

CREATE POLICY "System can manage user stats" ON player_stats
  FOR ALL WITH CHECK (true);
