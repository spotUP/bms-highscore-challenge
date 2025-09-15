-- First, ensure roles are properly set up
CREATE ROLE IF NOT EXISTS anon;
CREATE ROLE IF NOT EXISTS authenticated;
CREATE ROLE IF NOT EXISTS service_role;

-- Grant basic permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON user_roles TO authenticated;

-- Disable RLS temporarily
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_simple_policy" ON user_roles;
DROP POLICY IF EXISTS "admin_user_roles_access_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_read_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_basic_policy" ON user_roles;
DROP POLICY IF EXISTS "view_own_roles" ON user_roles;
DROP POLICY IF EXISTS "user_roles_access_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_policy" ON user_roles;
DROP POLICY IF EXISTS "role_based_access" ON user_roles;
DROP POLICY IF EXISTS "allow_read_own_or_admin" ON user_roles;
DROP POLICY IF EXISTS "allow_insert_admin" ON user_roles;
DROP POLICY IF EXISTS "allow_update_admin" ON user_roles;
DROP POLICY IF EXISTS "allow_delete_admin" ON user_roles;

-- Helper function to get authenticated user ID
CREATE OR REPLACE FUNCTION get_auth_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid;
$$;

-- Helper function to check if a user is admin (uses security definer to avoid recursion)
CREATE OR REPLACE FUNCTION is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = check_user_id 
        AND role = 'admin'
    );
END;
$$;

-- Create policies using the helper functions
CREATE POLICY "allow_read_own_or_admin" ON user_roles
    FOR SELECT
    USING (
        -- Can always read own records
        user_id = get_auth_user_id()
        OR 
        -- Admins can read all records
        is_admin(get_auth_user_id())
    );

CREATE POLICY "allow_insert_admin" ON user_roles
    FOR INSERT
    WITH CHECK (
        -- Only admins can insert
        is_admin(get_auth_user_id())
    );

CREATE POLICY "allow_update_admin" ON user_roles
    FOR UPDATE
    USING (
        -- Only admins can update
        is_admin(get_auth_user_id())
    );

CREATE POLICY "allow_delete_admin" ON user_roles
    FOR DELETE
    USING (
        -- Only admins can delete
        is_admin(get_auth_user_id())
    );

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON user_roles(user_id, role);

-- Grant minimum required permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;

-- Ensure we have initial admin (replace with your admin user ID)
INSERT INTO user_roles (user_id, role)
VALUES ('0f0672de-6b1a-49e1-8857-41fef18dc6f8', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Analyze for query planner
ANALYZE user_roles;