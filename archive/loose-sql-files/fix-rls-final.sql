-- Final RLS Policy Fix for Score Submission and Player Stats
-- This addresses the remaining RLS policy violations

-- 1. Check current RLS policies on scores table
SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'scores'
ORDER BY policyname;

-- 2. Check current RLS policies on player_stats table
SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'player_stats'
ORDER BY policyname;

-- 3. Drop restrictive policies that are blocking inserts
DROP POLICY IF EXISTS "scores_select_policy" ON scores;
DROP POLICY IF EXISTS "scores_insert_policy" ON scores;
DROP POLICY IF EXISTS "scores_update_policy" ON scores;
DROP POLICY IF EXISTS "scores_delete_policy" ON scores;

DROP POLICY IF EXISTS "player_stats_select_policy" ON player_stats;
DROP POLICY IF EXISTS "player_stats_insert_policy" ON player_stats;
DROP POLICY IF EXISTS "player_stats_update_policy" ON player_stats;
DROP POLICY IF EXISTS "player_stats_delete_policy" ON player_stats;

-- 4. Create permissive policies for scores table
-- Allow anyone to read scores
CREATE POLICY "scores_read_policy" ON scores
  FOR SELECT USING (true);

-- Allow authenticated users to insert scores (for the app)
CREATE POLICY "scores_insert_policy" ON scores
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Allow updates (needed for triggers)
CREATE POLICY "scores_update_policy" ON scores
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow deletes only for admins
CREATE POLICY "scores_delete_policy" ON scores
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- 5. Create permissive policies for player_stats table
-- Allow anyone to read player stats
CREATE POLICY "player_stats_read_policy" ON player_stats
  FOR SELECT USING (true);

-- Allow system/trigger inserts (SECURITY DEFINER functions bypass RLS)
CREATE POLICY "player_stats_insert_policy" ON player_stats
  FOR INSERT WITH CHECK (true);

-- Allow system/trigger updates
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

-- 6. Ensure the award_achievements function has SECURITY DEFINER
CREATE OR REPLACE FUNCTION award_achievements()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update or create player stats
    INSERT INTO player_stats (
        player_name,
        total_scores,
        total_games_played,
        total_score,
        best_score,
        last_score_date
    )
    VALUES (
        NEW.player_name,
        1,
        1,
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

    -- Award achievements based on score
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

-- 7. Recreate the trigger
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores;
CREATE TRIGGER award_achievements_trigger
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION award_achievements();

-- 8. Test the policies
SELECT 'Testing policies...' as status;

-- Verify policies are created correctly
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename IN ('scores', 'player_stats')
ORDER BY tablename, policyname;

-- 9. Test with a simple insert (should work now)
-- This will be tested by the Node.js script

