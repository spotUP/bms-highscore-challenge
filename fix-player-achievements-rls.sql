-- Fix RLS policies for player_achievements table to allow admin operations
-- This allows admins to delete player achievement records

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage player achievements" ON player_achievements;
DROP POLICY IF EXISTS "Users can view player achievements" ON player_achievements;
DROP POLICY IF EXISTS "Anyone can view player achievements" ON player_achievements;

-- Create comprehensive policy for viewing (allow everyone to see achievements)
CREATE POLICY "Anyone can view player achievements" ON player_achievements
  FOR SELECT USING (true);

-- Create policy for admin management (insert, update, delete)
CREATE POLICY "Admin can manage player achievements" ON player_achievements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Add policy for the system to insert achievements automatically
CREATE POLICY "System can insert player achievements" ON player_achievements
  FOR INSERT WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON player_achievements TO authenticated;
GRANT SELECT ON player_achievements TO anon;