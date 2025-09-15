-- Emergency fix for player_stats RLS policies
-- This fixes the "new row violates row-level security policy" error
-- Run this on the production database

-- First check what policies exist
SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'player_stats';

-- Drop existing restrictive policies on player_stats
DROP POLICY IF EXISTS "System can manage player stats" ON player_stats;
DROP POLICY IF EXISTS "Allow authenticated insert/update on player_stats" ON player_stats;
DROP POLICY IF EXISTS "Anyone can view player stats" ON player_stats;
DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON player_stats;
DROP POLICY IF EXISTS "Allow public read on player_stats" ON player_stats;
DROP POLICY IF EXISTS "Allow authenticated insert on player_stats" ON player_stats;

-- Create permissive policies that allow the system to function
-- Allow everyone to read player stats
CREATE POLICY "player_stats_select_policy" ON player_stats
  FOR SELECT USING (true);

-- Allow inserts from anywhere (needed for triggers)
CREATE POLICY "player_stats_insert_policy" ON player_stats
  FOR INSERT WITH CHECK (true);

-- Allow updates from anywhere (needed for triggers)  
CREATE POLICY "player_stats_update_policy" ON player_stats
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow deletes only for admins (if user_roles table exists)
DROP POLICY IF EXISTS "player_stats_delete_policy" ON player_stats;
CREATE POLICY "player_stats_delete_policy" ON player_stats
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Ensure the trigger function has SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION award_achievements()
RETURNS TRIGGER
SECURITY DEFINER -- This is crucial - allows function to bypass RLS
SET search_path = public -- Security best practice
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

-- Ensure the trigger is set up correctly
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores;
CREATE TRIGGER award_achievements_trigger
    AFTER INSERT OR UPDATE ON scores
    FOR EACH ROW
    EXECUTE FUNCTION award_achievements();

-- Check the policies were created correctly
SELECT schemaname, tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE tablename = 'player_stats'
ORDER BY policyname;
