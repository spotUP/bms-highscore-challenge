-- Fix RLS policies for player_achievements to allow service role delete operations
-- Drop all existing restrictive policies
DROP POLICY IF EXISTS "Admin can manage player achievements" ON player_achievements;
DROP POLICY IF EXISTS "Tournament admins can manage player achievements" ON player_achievements;
DROP POLICY IF EXISTS "Users can view player achievements" ON player_achievements;
DROP POLICY IF EXISTS "Anyone can view player achievements" ON player_achievements;
DROP POLICY IF EXISTS "System can insert player achievements" ON player_achievements;
DROP POLICY IF EXISTS "Enable read access for all users" ON player_achievements;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON player_achievements;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON player_achievements;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON player_achievements;

-- Create liberal policies that allow service role operations
CREATE POLICY "Enable read access for all users" ON "player_achievements"
    AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "player_achievements"
    AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON "player_achievements"
    AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users only" ON "player_achievements"
    AS PERMISSIVE FOR DELETE TO authenticated USING (true);