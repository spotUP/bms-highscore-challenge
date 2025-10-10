-- Enable RLS on tables that have policies but RLS disabled
-- This fixes critical security vulnerabilities identified by the database linter

-- Enable RLS on admin_users table
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on tournament_members table
ALTER TABLE tournament_members ENABLE ROW LEVEL SECURITY;

-- Enable RLS on games table (already has policies)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_role_cache table
ALTER TABLE user_role_cache ENABLE ROW LEVEL SECURITY;

-- Add security policies for admin_users table
-- Only admins can view admin users
CREATE POLICY "Admin users can view admin_users" ON admin_users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only service role can manage admin_users
CREATE POLICY "Service role can manage admin_users" ON admin_users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add security policies for user_roles table
-- Users can view their own roles
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all roles
CREATE POLICY "Admins can view all user roles" ON user_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- Only admins can manage user roles
CREATE POLICY "Admins can manage user roles" ON user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- Add security policies for tournament_members table
-- Users can view tournament members for tournaments they are part of
CREATE POLICY "Users can view tournament members" ON tournament_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM tournament_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.tournament_id = tournament_members.tournament_id
    )
  );

-- Tournament admins/owners can manage members
CREATE POLICY "Tournament admins can manage members" ON tournament_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournament_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.tournament_id = tournament_members.tournament_id
      AND tm.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournament_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.tournament_id = tournament_members.tournament_id
      AND tm.role IN ('admin', 'owner')
    )
  );

-- Add security policies for games table
-- Everyone can read games
CREATE POLICY "Anyone can view games" ON games
  FOR SELECT TO public
  USING (true);

-- Only authenticated users can create games
CREATE POLICY "Authenticated users can create games" ON games
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only game creators or admins can update games
CREATE POLICY "Game creators and admins can update games" ON games
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only game creators or admins can delete games
CREATE POLICY "Game creators and admins can delete games" ON games
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Add security policies for user_role_cache table
-- Users can view their own role cache
CREATE POLICY "Users can view their own role cache" ON user_role_cache
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only service role can manage user_role_cache (for cache updates)
CREATE POLICY "Service role can manage user_role_cache" ON user_role_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);