-- Anonymous achievements support: award achievements by player_name when no authenticated user
-- Adds a parallel function and RPC for anonymous players, and updates the trigger to call it as fallback

-- 1) Function: check and award achievements for anonymous (by player name + tournament)
CREATE OR REPLACE FUNCTION check_and_award_achievements_for_player(
  p_player_name TEXT,
  p_tournament_id UUID,
  p_game_id UUID,
  p_score INTEGER,
  p_is_first_place BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  new_achievements JSON := '[]'::json;
  achievement_count INTEGER := 0;
  -- Derived stats for this player within the tournament
  v_total_scores INTEGER := 0;
  v_total_games_played INTEGER := 0;
  v_best_score INTEGER := 0;
BEGIN
  -- Derive stats from scores table for anonymous path
  SELECT 
    COUNT(*) AS total_scores,
    COUNT(DISTINCT game_id) AS total_games_played,
    COALESCE(MAX(score), 0) AS best_score
  INTO v_total_scores, v_total_games_played, v_best_score
  FROM scores
  WHERE player_name = p_player_name
    AND tournament_id = p_tournament_id;

  -- Include the current score in derived stats (this function is called AFTER INSERT/UPDATE)
  v_total_scores := v_total_scores; -- already includes NEW due to AFTER trigger
  v_total_games_played := v_total_games_played; -- same
  v_best_score := GREATEST(v_best_score, p_score);

  -- Loop through active achievements for this tournament that the player doesn't already have
  FOR achievement_record IN 
    SELECT * FROM achievements 
    WHERE is_active = true 
      AND tournament_id = p_tournament_id
      AND id NOT IN (
        SELECT achievement_id FROM player_achievements 
        WHERE player_name = p_player_name 
          AND tournament_id = p_tournament_id
      )
  LOOP
    DECLARE
      should_award BOOLEAN := false;
    BEGIN
      CASE achievement_record.type
        WHEN 'first_score' THEN
          should_award := v_total_scores = 1;
        WHEN 'first_place' THEN
          should_award := p_is_first_place;
        WHEN 'score_milestone' THEN
          should_award := p_score >= (achievement_record.criteria->>'min_score')::INTEGER;
        WHEN 'game_master' THEN
          should_award := v_total_games_played >= (achievement_record.criteria->>'game_count')::INTEGER;
        WHEN 'high_scorer' THEN
          should_award := p_score >= (achievement_record.criteria->>'min_score')::INTEGER;
        WHEN 'consistent_player' THEN
          should_award := v_total_scores >= (achievement_record.criteria->>'min_scores')::INTEGER;
        WHEN 'perfectionist' THEN
          should_award := p_score >= (achievement_record.criteria->>'min_score')::INTEGER;
        ELSE
          should_award := false;
      END CASE;

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
          NULL, -- anonymous
          p_player_name,
          achievement_record.id,
          p_tournament_id,
          p_game_id,
          p_score,
          jsonb_build_object(
            'unlocked_via', achievement_record.type,
            'criteria_met', achievement_record.criteria,
            'anonymous', true
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
    'achievement_count', achievement_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) RPC: get recent achievements by tournament and player_name (anonymous-friendly)
CREATE OR REPLACE FUNCTION get_recent_achievements_by_tournament(
    p_tournament_id UUID,
    p_player_name TEXT,
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
    WHERE pa.tournament_id = p_tournament_id
      AND UPPER(pa.player_name) = UPPER(p_player_name)
      AND pa.unlocked_at >= NOW() - (p_since_minutes || ' minutes')::INTERVAL
    ORDER BY pa.unlocked_at DESC;
END;
$$;

-- 3) Update the trigger to call anonymous function when auth user is missing
CREATE OR REPLACE FUNCTION trigger_achievement_check_for_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_place BOOLEAN := false;
  result JSON;
  score_user_id UUID;
BEGIN
  -- Safely attempt to read a user_id from NEW via JSON, which won't error if the column is missing.
  BEGIN
    score_user_id := (to_jsonb(NEW)->>'user_id')::uuid;
  EXCEPTION WHEN others THEN
    score_user_id := NULL;
  END;

  IF score_user_id IS NULL THEN
    score_user_id := auth.uid();
  END IF;

  -- Check if this is a first place score within this tournament
  SELECT NOT EXISTS(
    SELECT 1 FROM scores 
    WHERE game_id = NEW.game_id 
      AND tournament_id = NEW.tournament_id
      AND score > NEW.score
  ) INTO is_first_place;

  IF score_user_id IS NOT NULL THEN
    -- User-scoped path
    SELECT check_and_award_achievements_for_user(
      score_user_id,
      NEW.player_name,
      NEW.tournament_id,
      NEW.game_id,
      NEW.score,
      is_first_place
    ) INTO result;
  ELSE
    -- Anonymous path
    SELECT check_and_award_achievements_for_player(
      NEW.player_name,
      NEW.tournament_id,
      NEW.game_id,
      NEW.score,
      is_first_place
    ) INTO result;
  END IF;

  IF (result->>'achievement_count')::INTEGER > 0 THEN
    RAISE NOTICE '[Achievements] % new unlocks for % in tournament %', 
      result->>'achievement_count', NEW.player_name, NEW.tournament_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS achievement_check_trigger ON scores;
CREATE TRIGGER achievement_check_trigger
  AFTER INSERT OR UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_check_for_user();
