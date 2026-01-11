-- Fix: avoid referencing NEW.user_id directly in achievement trigger on scores
-- Safely extract optional user_id and fall back to auth.uid()

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

    -- Optional logging
    IF (result->>'achievement_count')::INTEGER > 0 THEN
      RAISE NOTICE 'User % (player %) unlocked % achievements in tournament %', 
        score_user_id, NEW.player_name, result->>'achievement_count', NEW.tournament_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger to ensure it points at the latest function (idempotent)
DROP TRIGGER IF EXISTS achievement_check_trigger ON scores;
CREATE TRIGGER achievement_check_trigger
  AFTER INSERT OR UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_check_for_user();
