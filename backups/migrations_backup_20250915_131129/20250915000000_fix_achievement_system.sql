-- Fix the achievement system to properly award achievements when scores are submitted

-- Drop the old trigger first
DROP TRIGGER IF EXISTS achievement_check_trigger ON scores;

-- Create a proper achievement checking function that works with tournaments
CREATE OR REPLACE FUNCTION check_and_award_achievements_v2(
  p_score_id UUID,
  p_player_name TEXT,
  p_game_id UUID,
  p_score INTEGER,
  p_tournament_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  new_achievements JSON := '[]'::json;
  achievement_array JSON[] := ARRAY[]::JSON[];
  is_first_place BOOLEAN := false;
  player_score_count INTEGER;
BEGIN
  -- Check if this is a first place score in the tournament
  SELECT NOT EXISTS(
    SELECT 1 FROM scores
    WHERE game_id = p_game_id
    AND tournament_id = p_tournament_id
    AND score > p_score
  ) INTO is_first_place;

  -- Get player's score count in this tournament
  SELECT COUNT(*) INTO player_score_count
  FROM scores
  WHERE player_name = p_player_name
  AND tournament_id = p_tournament_id;

  -- Check for achievements in this tournament
  FOR achievement_record IN
    SELECT a.* FROM achievements a
    WHERE a.is_active = true
    AND a.tournament_id = p_tournament_id
    AND a.id NOT IN (
      SELECT achievement_id FROM player_achievements
      WHERE player_name = p_player_name
      AND tournament_id = p_tournament_id
    )
  LOOP
    -- Check if achievement criteria is met
    CASE achievement_record.type
      WHEN 'first_score' THEN
        -- First score achievement (everyone gets this on their first score)
        IF player_score_count = 1 THEN
          -- Award achievement
          INSERT INTO player_achievements (
            player_name,
            achievement_id,
            tournament_id,
            score_id,
            user_id,
            earned_at
          ) VALUES (
            p_player_name,
            achievement_record.id,
            p_tournament_id,
            p_score_id,
            p_user_id,
            NOW()
          );

          achievement_array := achievement_array || jsonb_build_object(
            'id', achievement_record.id,
            'name', achievement_record.name,
            'description', achievement_record.description,
            'badge_icon', achievement_record.badge_icon,
            'badge_color', achievement_record.badge_color,
            'points', achievement_record.points
          )::json;
        END IF;

      WHEN 'first_place' THEN
        -- First place achievement
        IF is_first_place AND (
          achievement_record.criteria IS NULL OR
          achievement_record.criteria->>'game_id' IS NULL OR
          (achievement_record.criteria->>'game_id')::uuid = p_game_id
        ) THEN
          INSERT INTO player_achievements (
            player_name,
            achievement_id,
            tournament_id,
            score_id,
            user_id,
            earned_at
          ) VALUES (
            p_player_name,
            achievement_record.id,
            p_tournament_id,
            p_score_id,
            p_user_id,
            NOW()
          );

          achievement_array := achievement_array || jsonb_build_object(
            'id', achievement_record.id,
            'name', achievement_record.name,
            'description', achievement_record.description,
            'badge_icon', achievement_record.badge_icon,
            'badge_color', achievement_record.badge_color,
            'points', achievement_record.points
          )::json;
        END IF;

      WHEN 'score_milestone' THEN
        -- Score milestone achievement
        IF (achievement_record.criteria->>'threshold')::int IS NOT NULL AND
           p_score >= (achievement_record.criteria->>'threshold')::int AND
           (achievement_record.criteria->>'game_id' IS NULL OR
            (achievement_record.criteria->>'game_id')::uuid = p_game_id) THEN
          INSERT INTO player_achievements (
            player_name,
            achievement_id,
            tournament_id,
            score_id,
            user_id,
            earned_at
          ) VALUES (
            p_player_name,
            achievement_record.id,
            p_tournament_id,
            p_score_id,
            p_user_id,
            NOW()
          );

          achievement_array := achievement_array || jsonb_build_object(
            'id', achievement_record.id,
            'name', achievement_record.name,
            'description', achievement_record.description,
            'badge_icon', achievement_record.badge_icon,
            'badge_color', achievement_record.badge_color,
            'points', achievement_record.points
          )::json;
        END IF;

      WHEN 'high_scorer' THEN
        -- High scorer achievement (top N players)
        IF (achievement_record.criteria->>'rank')::int IS NOT NULL THEN
          DECLARE
            player_rank INTEGER;
          BEGIN
            -- Get player's rank in this game/tournament
            SELECT rank_num INTO player_rank FROM (
              SELECT
                player_name,
                ROW_NUMBER() OVER (ORDER BY MAX(score) DESC) as rank_num
              FROM scores
              WHERE game_id = p_game_id
              AND tournament_id = p_tournament_id
              GROUP BY player_name
            ) ranked
            WHERE player_name = p_player_name;

            IF player_rank <= (achievement_record.criteria->>'rank')::int THEN
              INSERT INTO player_achievements (
                player_name,
                achievement_id,
                tournament_id,
                score_id,
                user_id,
                earned_at
              ) VALUES (
                p_player_name,
                achievement_record.id,
                p_tournament_id,
                p_score_id,
                p_user_id,
                NOW()
              ) ON CONFLICT DO NOTHING;

              achievement_array := achievement_array || jsonb_build_object(
                'id', achievement_record.id,
                'name', achievement_record.name,
                'description', achievement_record.description,
                'badge_icon', achievement_record.badge_icon,
                'badge_color', achievement_record.badge_color,
                'points', achievement_record.points
              )::json;
            END IF;
          END;
        END IF;

      ELSE
        -- Other achievement types can be added here
        NULL;
    END CASE;
  END LOOP;

  -- Return the list of new achievements
  IF array_length(achievement_array, 1) > 0 THEN
    new_achievements := to_json(achievement_array);
  END IF;

  RETURN new_achievements;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a new trigger function that calls the updated achievement check
CREATE OR REPLACE FUNCTION trigger_achievement_check_v2()
RETURNS TRIGGER AS $$
DECLARE
  result JSON;
  user_id UUID;
BEGIN
  -- Try to get user_id if available (may be NULL for anonymous scores)
  user_id := NEW.user_id;

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

-- Create the new trigger
CREATE TRIGGER achievement_check_trigger_v2
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_check_v2();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_and_award_achievements_v2 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION trigger_achievement_check_v2 TO anon, authenticated;

-- Update RLS policy for player_achievements to allow system inserts
DROP POLICY IF EXISTS "System can insert player achievements" ON player_achievements;
CREATE POLICY "System can insert player achievements" ON player_achievements
  FOR INSERT
  WITH CHECK (true);

-- Also ensure players can view their own achievements
DROP POLICY IF EXISTS "Players can view own achievements" ON player_achievements;
CREATE POLICY "Players can view own achievements" ON player_achievements
  FOR SELECT
  USING (true);  -- Allow everyone to see achievements (for leaderboards)

-- Backfill achievements for existing scores (optional but recommended)
-- This will award "first_score" achievements to players who already have scores
DO $$
DECLARE
  score_record RECORD;
  result JSON;
BEGIN
  -- Process recent scores to award achievements retroactively
  FOR score_record IN
    SELECT DISTINCT ON (player_name, tournament_id)
      id, player_name, game_id, score, tournament_id, user_id, created_at
    FROM scores
    WHERE created_at > NOW() - INTERVAL '7 days'  -- Only process recent scores
    ORDER BY player_name, tournament_id, created_at ASC
  LOOP
    -- Check if player already has any achievements
    IF NOT EXISTS (
      SELECT 1 FROM player_achievements
      WHERE player_name = score_record.player_name
      AND tournament_id = score_record.tournament_id
    ) THEN
      -- Award achievements for this score
      PERFORM check_and_award_achievements_v2(
        score_record.id,
        score_record.player_name,
        score_record.game_id,
        score_record.score,
        score_record.tournament_id,
        score_record.user_id
      );
    END IF;
  END LOOP;
END $$;

-- Add comment explaining the system
COMMENT ON FUNCTION check_and_award_achievements_v2 IS 'Checks and awards achievements to players based on their scores and tournament progress. Called automatically when scores are submitted.';