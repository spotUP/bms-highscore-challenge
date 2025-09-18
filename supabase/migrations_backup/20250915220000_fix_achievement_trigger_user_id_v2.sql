-- Fix the achievement trigger to handle missing user_id field properly
-- Replace the problematic trigger function that directly references NEW.user_id

DROP TRIGGER IF EXISTS achievement_check_trigger_v2 ON scores;

-- Create a safe trigger function that handles missing user_id field
CREATE OR REPLACE FUNCTION trigger_achievement_check_v2()
RETURNS TRIGGER AS $$
DECLARE
  result JSON;
  user_id UUID;
BEGIN
  -- Safely try to get user_id using JSON approach to avoid "field not found" errors
  BEGIN
    user_id := (to_jsonb(NEW)->>'user_id')::uuid;
  EXCEPTION WHEN others THEN
    user_id := NULL;
  END;

  -- If no user_id in record, try to get it from auth context
  IF user_id IS NULL THEN
    user_id := auth.uid();
  END IF;

  -- Check and award achievements
  SELECT check_and_award_achievements_v2(
    NEW.id,
    NEW.player_name,
    NEW.game_id,
    NEW.score,
    NEW.tournament_id,
    user_id
  ) INTO result;

  -- Log if achievements were awarded (optional)
  IF result != '[]'::json AND result IS NOT NULL THEN
    RAISE NOTICE 'Achievements awarded to %: %', NEW.player_name, result;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER achievement_check_trigger_v2
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_check_v2();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION trigger_achievement_check_v2 TO anon, authenticated;