-- First, disable RLS on both tables
ALTER TABLE tournament_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read their own tournament memberships" ON tournament_members;
DROP POLICY IF EXISTS "Admins can read all tournament memberships" ON tournament_members;
DROP POLICY IF EXISTS "tournament_members_policy" ON tournament_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON tournament_members;
DROP POLICY IF EXISTS "Admins can view all memberships" ON tournament_members;
DROP POLICY IF EXISTS "tournament_members_select_policy" ON tournament_members;
DROP POLICY IF EXISTS "user_roles_select_policy" ON user_roles;

-- Drop policies on user_roles if they exist
DROP POLICY IF EXISTS "Users can read their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON user_roles;

-- Enable RLS on both tables
ALTER TABLE tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Simple policy for tournament_members
CREATE POLICY "tournament_members_select_policy"
ON tournament_members FOR SELECT
USING (
    auth.uid() = user_id OR
    auth.uid() IN (
        SELECT user_id FROM user_roles 
        WHERE role = 'admin'
    )
);

-- Simple policy for user_roles
CREATE POLICY "user_roles_select_policy"
ON user_roles FOR SELECT
USING (
    auth.uid() = user_id OR
    auth.uid() IN (
        SELECT user_id FROM user_roles 
        WHERE role = 'admin'
    )
);

-- Ensure proper indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_tournament_members_user_id ON tournament_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON user_roles(user_id, role);

-- Grant necessary permissions
GRANT SELECT ON tournament_members TO authenticated;
GRANT SELECT ON user_roles TO authenticated;

-- Analyze tables to update statistics
ANALYZE tournament_members;
ANALYZE user_roles;