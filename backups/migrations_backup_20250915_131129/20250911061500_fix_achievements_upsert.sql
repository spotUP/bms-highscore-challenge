-- Fix duplicate key errors when awarding achievements by making inserts idempotent
-- Also ensure the supporting unique constraint exists on (player_name, achievement_id)

-- 1) Ensure unique constraint exists (safe if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'player_achievements'
      AND c.conname = 'player_achievements_player_name_achievement_id_key'
  ) THEN
    ALTER TABLE player_achievements
      ADD CONSTRAINT player_achievements_player_name_achievement_id_key
      UNIQUE (player_name, achievement_id);
  END IF;
END
$$;

-- 2) Recreate the function to use ON CONFLICT DO NOTHING when inserting into player_achievements
CREATE OR REPLACE FUNCTION check_and_award_achievements(
  p_player_name TEXT,
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
  -- Normalize player name (UPPER) for consistent uniqueness
  p_player_name := UPPER(COALESCE(p_player_name, ''));

  -- Get or create player stats
  INSERT INTO player_stats (player_name, total_scores, total_games_played, first_place_count, total_score, best_score, last_score_date)
  VALUES (p_player_name, 1, 1, CASE WHEN p_is_first_place THEN 1 ELSE 0 END, p_score, p_score, NOW())
  ON CONFLICT (player_name) DO UPDATE SET
    total_scores = player_stats.total_scores + 1,
    total_games_played = player_stats.total_games_played + 1,
    first_place_count = player_stats.first_place_count + CASE WHEN p_is_first_place THEN 1 ELSE 0 END,
    total_score = player_stats.total_score + p_score,
    best_score = GREATEST(player_stats.best_score, p_score),
    last_score_date = NOW(),
    updated_at = NOW()
  RETURNING * INTO player_stat_record;

  -- Check for achievements (only those not yet awarded)
  FOR achievement_record IN 
    SELECT * FROM achievements 
    WHERE is_active = true 
    AND id NOT IN (
      SELECT achievement_id FROM player_achievements 
      WHERE player_name = p_player_name
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

      -- Award achievement if criteria met (idempotent)
      IF should_award THEN
        DECLARE awarded_id UUID;
        BEGIN
          INSERT INTO player_achievements (player_name, achievement_id, game_id, score, metadata)
          VALUES (
            p_player_name,
            achievement_record.id,
            p_game_id,
            p_score,
            jsonb_build_object(
              'unlocked_via', achievement_record.type,
              'criteria_met', achievement_record.criteria
            )
          )
          ON CONFLICT (player_name, achievement_id) DO NOTHING
          RETURNING id INTO awarded_id;

          -- Only append to new_achievements if a new row was actually inserted in this call
          IF awarded_id IS NOT NULL THEN
            achievement_count := achievement_count + 1;
            new_achievements := new_achievements || jsonb_build_object(
              'id', achievement_record.id,
              'name', achievement_record.name,
              'description', achievement_record.description,
              'badge_icon', achievement_record.badge_icon,
              'badge_color', achievement_record.badge_color,
              'points', achievement_record.points
            );
          END IF;
        END;
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
