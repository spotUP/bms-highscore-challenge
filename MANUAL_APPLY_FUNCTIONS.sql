-- Apply these functions manually in the Supabase SQL editor
-- Copy and paste this entire block into the SQL editor and run it

-- Function to recalculate achievements after score deletion
CREATE OR REPLACE FUNCTION recalculate_achievements_after_deletion(
  p_player_name TEXT,
  p_tournament_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  player_stat_record RECORD;
  current_achievements RECORD;
  removed_achievements JSON := '[]'::json;
  removed_count INTEGER := 0;
  v_tournament_filter TEXT := '';
BEGIN
  -- Add tournament filter if provided
  IF p_tournament_id IS NOT NULL THEN
    v_tournament_filter := ' AND tournament_id = ''' || p_tournament_id || '''';
  END IF;

  -- Recalculate player stats based on remaining scores
  EXECUTE format('
    SELECT
      COUNT(*) as total_scores,
      COUNT(DISTINCT game_id) as total_games_played,
      COALESCE(SUM(score), 0) as total_score,
      COALESCE(MAX(score), 0) as best_score,
      MAX(created_at) as last_score_date
    FROM scores
    WHERE UPPER(player_name) = UPPER($1) %s
  ', v_tournament_filter)
  USING p_player_name
  INTO player_stat_record;

  -- Count first place achievements
  DECLARE
    first_place_count INTEGER := 0;
  BEGIN
    EXECUTE format('
      SELECT COUNT(DISTINCT game_id)
      FROM scores s1
      WHERE UPPER(s1.player_name) = UPPER($1) %s
      AND NOT EXISTS (
        SELECT 1 FROM scores s2
        WHERE s2.game_id = s1.game_id
        AND s2.score > s1.score %s
      )
    ', v_tournament_filter, v_tournament_filter)
    USING p_player_name
    INTO first_place_count;

    player_stat_record.first_place_count := first_place_count;
  END;

  -- Update player_stats table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_stats') THEN
    INSERT INTO player_stats (
      player_name,
      total_scores,
      total_games_played,
      first_place_count,
      total_score,
      best_score,
      last_score_date,
      updated_at
    )
    VALUES (
      p_player_name,
      player_stat_record.total_scores,
      player_stat_record.total_games_played,
      player_stat_record.first_place_count,
      player_stat_record.total_score,
      player_stat_record.best_score,
      player_stat_record.last_score_date,
      NOW()
    )
    ON CONFLICT (player_name) DO UPDATE SET
      total_scores = EXCLUDED.total_scores,
      total_games_played = EXCLUDED.total_games_played,
      first_place_count = EXCLUDED.first_place_count,
      total_score = EXCLUDED.total_score,
      best_score = EXCLUDED.best_score,
      last_score_date = EXCLUDED.last_score_date,
      updated_at = NOW();
  END IF;

  -- Check each current achievement to see if it should still be valid
  FOR current_achievements IN
    SELECT pa.id, pa.achievement_id, a.type, a.criteria, a.name
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE UPPER(pa.player_name) = UPPER(p_player_name)
      AND (p_tournament_id IS NULL OR pa.tournament_id = p_tournament_id)
  LOOP
    DECLARE
      should_keep BOOLEAN := false;
      achievement_data RECORD;
    BEGIN
      -- Get achievement details
      SELECT * FROM achievements WHERE id = current_achievements.achievement_id INTO achievement_data;

      -- Check if achievement criteria are still met
      CASE current_achievements.type
        WHEN 'first_score' THEN
          should_keep := player_stat_record.total_scores >= 1;

        WHEN 'first_place' THEN
          should_keep := player_stat_record.first_place_count >= 1;

        WHEN 'score_milestone' THEN
          -- Check if player still has a score that meets the milestone
          DECLARE
            min_score INTEGER := (achievement_data.criteria->>'min_score')::INTEGER;
            has_qualifying_score BOOLEAN := false;
          BEGIN
            EXECUTE format('
              SELECT EXISTS(
                SELECT 1 FROM scores
                WHERE UPPER(player_name) = UPPER($1)
                AND score >= $2 %s
              )
            ', v_tournament_filter)
            USING p_player_name, min_score
            INTO has_qualifying_score;

            should_keep := has_qualifying_score;
          END;

        WHEN 'game_master' THEN
          should_keep := player_stat_record.total_games_played >= (achievement_data.criteria->>'game_count')::INTEGER;

        WHEN 'high_scorer' THEN
          should_keep := player_stat_record.best_score >= (achievement_data.criteria->>'min_score')::INTEGER;

        WHEN 'consistent_player' THEN
          should_keep := player_stat_record.total_scores >= (achievement_data.criteria->>'min_scores')::INTEGER;

        ELSE
          -- For unknown types, keep the achievement (conservative approach)
          should_keep := true;
      END CASE;

      -- Remove achievement if criteria no longer met
      IF NOT should_keep THEN
        DELETE FROM player_achievements WHERE id = current_achievements.id;

        removed_achievements := removed_achievements || jsonb_build_object(
          'id', current_achievements.achievement_id,
          'name', current_achievements.name,
          'type', current_achievements.type
        );

        removed_count := removed_count + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'player_name', p_player_name,
    'removed_achievements', removed_achievements,
    'removed_count', removed_count,
    'updated_stats', row_to_json(player_stat_record)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'player_name', p_player_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle score deletion trigger
CREATE OR REPLACE FUNCTION trigger_achievement_recalculation_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  result JSON;
BEGIN
  -- Recalculate achievements for the player whose score was deleted
  SELECT recalculate_achievements_after_deletion(
    OLD.player_name,
    OLD.tournament_id
  ) INTO result;

  -- Log the recalculation (optional)
  IF (result->>'removed_count')::INTEGER > 0 THEN
    RAISE NOTICE 'Player % had % achievements removed after score deletion',
      OLD.player_name, result->>'removed_count';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for score deletion
DROP TRIGGER IF EXISTS achievement_recalc_on_delete_trigger ON scores;
CREATE TRIGGER achievement_recalc_on_delete_trigger
  AFTER DELETE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_recalculation_on_delete();

-- Create a function that can be called manually for bulk recalculation
CREATE OR REPLACE FUNCTION recalculate_all_achievements_for_tournament(
  p_tournament_id UUID
)
RETURNS JSON AS $$
DECLARE
  player_name_record RECORD;
  total_players INTEGER := 0;
  total_removed INTEGER := 0;
  result JSON;
  results JSON := '[]'::json;
BEGIN
  -- Get all unique players in the tournament
  FOR player_name_record IN
    SELECT DISTINCT player_name
    FROM scores
    WHERE tournament_id = p_tournament_id
  LOOP
    total_players := total_players + 1;

    -- Recalculate achievements for this player
    SELECT recalculate_achievements_after_deletion(
      player_name_record.player_name,
      p_tournament_id
    ) INTO result;

    total_removed := total_removed + (result->>'removed_count')::INTEGER;

    results := results || result;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'tournament_id', p_tournament_id,
    'total_players_processed', total_players,
    'total_achievements_removed', total_removed,
    'details', results
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'tournament_id', p_tournament_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;