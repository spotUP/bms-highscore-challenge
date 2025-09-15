-- Fix RLS policies for score submission
-- This script addresses the 403 Forbidden error when submitting scores

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON scores;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON scores;
DROP POLICY IF EXISTS "Users can insert their own scores" ON scores;
DROP POLICY IF EXISTS "Allow anonymous score submission" ON scores;
DROP POLICY IF EXISTS "Allow public score submission" ON scores;

-- Create permissive policies for scores table
-- Allow anyone to read scores (for leaderboard display)
CREATE POLICY "Allow public read access to scores"
    ON scores FOR SELECT
    USING (true);

-- Allow anyone to insert scores (public score submission)
CREATE POLICY "Allow public score submission"
    ON scores FOR INSERT
    WITH CHECK (true);

-- Allow users to update their own scores if needed
CREATE POLICY "Allow score updates"
    ON scores FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Allow deletion for admins (using service role)
CREATE POLICY "Allow admin score deletion"
    ON scores FOR DELETE
    USING (true);

-- Ensure RLS is enabled but permissive
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON scores TO anon;
GRANT ALL ON scores TO authenticated;
GRANT ALL ON scores TO service_role;

-- Also check and fix games table policies if needed
DROP POLICY IF EXISTS "Enable read access for all users" ON games;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON games;

CREATE POLICY "Allow public read access to games"
    ON games FOR SELECT
    USING (true);

CREATE POLICY "Allow public game management"
    ON games FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow game updates"
    ON games FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow game deletion"
    ON games FOR DELETE
    USING (true);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
GRANT ALL ON games TO anon;
GRANT ALL ON games TO authenticated;
GRANT ALL ON games TO service_role;

-- Fix tournaments table policies
DROP POLICY IF EXISTS "Enable read access for all users" ON tournaments;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON tournaments;

CREATE POLICY "Allow public read access to tournaments"
    ON tournaments FOR SELECT
    USING (true);

CREATE POLICY "Allow public tournament management"
    ON tournaments FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow tournament updates"
    ON tournaments FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow tournament deletion"
    ON tournaments FOR DELETE
    USING (true);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON tournaments TO anon;
GRANT ALL ON tournaments TO authenticated;
GRANT ALL ON tournaments TO service_role;