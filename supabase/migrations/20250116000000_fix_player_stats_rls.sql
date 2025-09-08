-- Fix RLS policies for player_stats table to allow score submissions
-- This migration ensures that triggers can update player_stats when scores are inserted

-- Drop existing restrictive policies on player_stats
DROP POLICY IF EXISTS "System can manage player stats" ON player_stats;
DROP POLICY IF EXISTS "Allow authenticated insert/update on player_stats" ON player_stats;
DROP POLICY IF EXISTS "Anyone can view player stats" ON player_stats;
DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON player_stats;

-- Create more permissive policies that allow the system to function
-- Allow everyone to read player stats
CREATE POLICY "player_stats_select_policy" ON player_stats
  FOR SELECT USING (true);

-- Allow inserts from anywhere (needed for triggers)
CREATE POLICY "player_stats_insert_policy" ON player_stats
  FOR INSERT WITH CHECK (true);

-- Allow updates from anywhere (needed for triggers)
CREATE POLICY "player_stats_update_policy" ON player_stats
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow deletes only for admins
CREATE POLICY "player_stats_delete_policy" ON player_stats
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Ensure the trigger function exists and is accessible
-- This function is called by triggers when scores are inserted
CREATE OR REPLACE FUNCTION award_achievements()
RETURNS TRIGGER
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
BEGIN
    -- Update or create player stats
    INSERT INTO player_stats (
        player_name, 
        total_scores, 
        total_games_played, 
        first_place_count, 
        total_score, 
        best_score, 
        last_score_date
    )
    VALUES (
        NEW.player_name, 
        1, 
        1, 
        0, 
        NEW.score, 
        NEW.score, 
        NOW()
    )
    ON CONFLICT (player_name) DO UPDATE SET
        total_scores = player_stats.total_scores + 1,
        total_games_played = player_stats.total_games_played + 1,
        total_score = player_stats.total_score + NEW.score,
        best_score = GREATEST(player_stats.best_score, NEW.score),
        last_score_date = NOW(),
        updated_at = NOW();

    -- Award "First Score" achievement if this is player's first score
    IF NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'First Score'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id
        FROM achievements a
        WHERE a.name = 'First Score';
    END IF;

    -- Award "High Scorer" achievement if score >= 5000
    IF NEW.score >= 5000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'High Scorer'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id
        FROM achievements a
        WHERE a.name = 'High Scorer';
    END IF;

    -- Award "Score Hunter" achievement if score >= 10000
    IF NEW.score >= 10000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'Score Hunter'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id
        FROM achievements a
        WHERE a.name = 'Score Hunter';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores;
CREATE TRIGGER award_achievements_trigger
    AFTER INSERT OR UPDATE ON scores
    FOR EACH ROW
    EXECUTE FUNCTION award_achievements();

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON player_stats TO authenticated;
GRANT SELECT, INSERT ON player_achievements TO authenticated;
GRANT SELECT ON achievements TO authenticated;
