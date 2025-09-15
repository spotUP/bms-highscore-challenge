-- Make achievements scoped to tournaments created by specific users
-- This ensures achievements are separate per tournament creator, not per individual player

-- Remove the previous user-specific changes if they exist
ALTER TABLE public.player_achievements DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.player_stats DROP COLUMN IF EXISTS user_id;

-- Drop the user-specific constraints
ALTER TABLE public.player_achievements DROP CONSTRAINT IF EXISTS player_achievements_user_tournament_unique;
ALTER TABLE public.player_stats DROP CONSTRAINT IF EXISTS player_stats_user_tournament_unique;

-- Restore the original constraint but make it tournament-specific
-- This allows the same player name to get the same achievement in different tournaments
ALTER TABLE public.player_achievements DROP CONSTRAINT IF EXISTS player_achievements_unique_constraint;
ALTER TABLE public.player_achievements ADD CONSTRAINT player_achievements_tournament_unique 
  UNIQUE (player_name, achievement_id, tournament_id);

-- Update player_stats to be unique per player per tournament
-- This allows the same player name to have different stats in different tournaments
ALTER TABLE public.player_stats DROP CONSTRAINT IF EXISTS player_stats_pkey;
ALTER TABLE public.player_stats DROP CONSTRAINT IF EXISTS player_stats_player_name_key;
ALTER TABLE public.player_stats ADD CONSTRAINT player_stats_tournament_player_unique 
  UNIQUE (player_name, tournament_id);

-- Create function to check and award achievements scoped to tournament creator
CREATE OR REPLACE FUNCTION check_and_award_achievements_by_tournament(
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
  -- Get or create player stats for this player in this specific tournament
  INSERT INTO player_stats (
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
    p_player_name, 
    p_tournament_id, 
    1, 
    1, 
    CASE WHEN p_is_first_place THEN 1 ELSE 0 END, 
    p_score, 
    p_score, 
    NOW()
  )
  ON CONFLICT (player_name, tournament_id) DO UPDATE SET
    total_scores = player_stats.total_scores + 1,
    total_games_played = player_stats.total_games_played + 1,
    first_place_count = player_stats.first_place_count + CASE WHEN p_is_first_place THEN 1 ELSE 0 END,
    total_score = player_stats.total_score + p_score,
    best_score = GREATEST(player_stats.best_score, p_score),
    last_score_date = NOW(),
    updated_at = NOW()
  RETURNING * INTO player_stat_record;

  -- Check for achievements that this player hasn't earned in this specific tournament yet
  -- This ensures achievements are scoped to the tournament (and thus its creator)
  FOR achievement_record IN 
    SELECT * FROM achievements 
    WHERE is_active = true 
    AND tournament_id = p_tournament_id  -- Only achievements for this specific tournament
    AND id NOT IN (
      SELECT achievement_id FROM player_achievements 
      WHERE player_name = p_player_name 
      AND tournament_id = p_tournament_id  -- Only check within this tournament
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
          player_name, 
          achievement_id, 
          tournament_id,
          game_id, 
          score, 
          metadata
        )
        VALUES (
          p_player_name, 
          achievement_record.id, 
          p_tournament_id,
          p_game_id, 
          p_score,
          jsonb_build_object(
            'unlocked_via', achievement_record.type,
            'criteria_met', achievement_record.criteria,
            'tournament_creator', (
              SELECT created_by FROM tournaments WHERE id = p_tournament_id
            )
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
    'player_stats', row_to_json(player_stat_record),
    'tournament_id', p_tournament_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create updated trigger function that works with tournament scoping
CREATE OR REPLACE FUNCTION trigger_achievement_check_by_tournament()
RETURNS TRIGGER AS $$
DECLARE
  is_first_place BOOLEAN := false;
  result JSON;
BEGIN
  -- Check if this is a first place score within this specific tournament
  SELECT NOT EXISTS(
    SELECT 1 FROM scores 
    WHERE game_id = NEW.game_id 
    AND tournament_id = NEW.tournament_id  -- Only check within the same tournament
    AND score > NEW.score
  ) INTO is_first_place;

  -- Check and award achievements scoped to this tournament (and its creator)
  SELECT check_and_award_achievements_by_tournament(
    NEW.player_name,
    NEW.tournament_id,
    NEW.game_id,
    NEW.score,
    is_first_place
  ) INTO result;

  -- Log achievement unlocks (optional)
  IF (result->>'achievement_count')::INTEGER > 0 THEN
    RAISE NOTICE 'Player % unlocked % achievements in tournament %', 
      NEW.player_name, result->>'achievement_count', NEW.tournament_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger
DROP TRIGGER IF EXISTS achievement_check_trigger ON scores;
CREATE TRIGGER achievement_check_trigger
  AFTER INSERT OR UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_check_by_tournament();

-- Create RPC function to get recent achievements for a tournament
CREATE OR REPLACE FUNCTION get_recent_achievements_by_tournament(
    p_tournament_id UUID,
    p_player_name TEXT DEFAULT NULL,
    p_since_minutes INTEGER DEFAULT 1
)
RETURNS TABLE (
    achievement_id UUID,
    achievement_name TEXT,
    achievement_description TEXT,
    badge_icon TEXT,
    badge_color TEXT,
    points INTEGER,
    player_name TEXT,
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
        pa.player_name,
        pa.unlocked_at
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.tournament_id = p_tournament_id
    AND (p_player_name IS NULL OR pa.player_name = p_player_name)
    AND pa.unlocked_at >= NOW() - (p_since_minutes || ' minutes')::INTERVAL
    ORDER BY pa.unlocked_at DESC;
END;
$$;

-- Update RLS policies to be tournament-creator aware
DROP POLICY IF EXISTS "Users can view achievements in accessible tournaments" ON player_achievements;
DROP POLICY IF EXISTS "Users can view stats in accessible tournaments" ON player_stats;

-- Allow viewing achievements in tournaments you can access
CREATE POLICY "View achievements in accessible tournaments" ON player_achievements
  FOR SELECT USING (
    -- Public tournaments
    tournament_id IN (
      SELECT id FROM tournaments WHERE is_public = true
    )
    OR
    -- Tournaments you're a member of
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR
    -- Tournaments you created
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "View stats in accessible tournaments" ON player_stats
  FOR SELECT USING (
    -- Public tournaments
    tournament_id IN (
      SELECT id FROM tournaments WHERE is_public = true
    )
    OR
    -- Tournaments you're a member of
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR
    -- Tournaments you created
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
  );

-- System can still insert/update for triggers
CREATE POLICY "System can manage tournament achievements" ON player_achievements
  FOR ALL WITH CHECK (true);

CREATE POLICY "System can manage tournament stats" ON player_stats
  FOR ALL WITH CHECK (true);
