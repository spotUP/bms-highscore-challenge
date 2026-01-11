-- Fix score submission issues
-- Remove problematic check constraints and fix RLS policies

-- First, check what constraints exist
DO $$
BEGIN
    -- Drop check constraint if it exists and is problematic
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'scores_player_name_check'
    ) THEN
        ALTER TABLE scores DROP CONSTRAINT scores_player_name_check;
        RAISE NOTICE 'Dropped scores_player_name_check constraint';
    END IF;
END $$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Enable read access for all users" ON scores;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON scores;
DROP POLICY IF EXISTS "Users can insert their own scores" ON scores;
DROP POLICY IF EXISTS "Allow anonymous score submission" ON scores;
DROP POLICY IF EXISTS "Allow public score submission" ON scores;

-- Create simple, permissive policies for scores
CREATE POLICY "scores_select_policy" ON scores FOR SELECT USING (true);
CREATE POLICY "scores_insert_policy" ON scores FOR INSERT WITH CHECK (true);
CREATE POLICY "scores_update_policy" ON scores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "scores_delete_policy" ON scores FOR DELETE USING (true);

-- Ensure RLS is enabled
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Grant permissions to all roles
GRANT ALL ON scores TO anon;
GRANT ALL ON scores TO authenticated;
GRANT ALL ON scores TO service_role;

-- Also fix games table
DROP POLICY IF EXISTS "Enable read access for all users" ON games;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON games;
DROP POLICY IF EXISTS "Allow public read access to games" ON games;
DROP POLICY IF EXISTS "Allow public game management" ON games;

CREATE POLICY "games_select_policy" ON games FOR SELECT USING (true);
CREATE POLICY "games_insert_policy" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "games_update_policy" ON games FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "games_delete_policy" ON games FOR DELETE USING (true);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
GRANT ALL ON games TO anon;
GRANT ALL ON games TO authenticated;
GRANT ALL ON games TO service_role;

-- Fix tournaments table
DROP POLICY IF EXISTS "Enable read access for all users" ON tournaments;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON tournaments;
DROP POLICY IF EXISTS "Allow public read access to tournaments" ON tournaments;
DROP POLICY IF EXISTS "Allow public tournament management" ON tournaments;

CREATE POLICY "tournaments_select_policy" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert_policy" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "tournaments_update_policy" ON tournaments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "tournaments_delete_policy" ON tournaments FOR DELETE USING (true);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON tournaments TO anon;
GRANT ALL ON tournaments TO authenticated;
GRANT ALL ON tournaments TO service_role;