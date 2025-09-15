-- First disable RLS to set up everything
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
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

-- Helper function to extract user ID from request
CREATE OR REPLACE FUNCTION request_user_id() 
RETURNS uuid 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    claims jsonb;
    header_user_id text;
BEGIN
    -- Try to get claims from request.jwt.claims
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    IF claims IS NOT NULL AND claims->>'sub' IS NOT NULL THEN
        RETURN (claims->>'sub')::uuid;
    END IF;

    -- Fallback to header if available
    header_user_id := current_setting('request.headers', true)::jsonb->>'x-user-id';
    IF header_user_id IS NOT NULL THEN
        RETURN header_user_id::uuid;
    END IF;

    -- If no user found, return null
    RETURN NULL;
END;
$$;

-- Helper function to check admin status
CREATE OR REPLACE FUNCTION request_is_admin() 
RETURNS boolean 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := request_user_id();
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = current_user_id 
        AND role = 'admin'
    );
END;
$$;

-- Simple policy for reading roles
CREATE POLICY "allow_read_own_or_admin" ON user_roles FOR SELECT
USING (
    user_id = request_user_id() -- Own records
    OR request_is_admin() -- Admin access
);

-- Policy for inserting new roles (admin only)
CREATE POLICY "allow_insert_admin" ON user_roles FOR INSERT
WITH CHECK (request_is_admin());

-- Policy for updating roles (admin only)
CREATE POLICY "allow_update_admin" ON user_roles FOR UPDATE
USING (request_is_admin());

-- Policy for deleting roles (admin only)
CREATE POLICY "allow_delete_admin" ON user_roles FOR DELETE
USING (request_is_admin());

-- Grant execute permissions on our helper functions
GRANT EXECUTE ON FUNCTION request_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION request_is_admin TO authenticated;

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON user_roles(user_id, role);

-- Grant basic table permissions
GRANT SELECT ON user_roles TO authenticated;

-- DEBUG: Show current database role and settings
DO $$
BEGIN
    RAISE NOTICE 'Current database role: %', current_user;
    RAISE NOTICE 'Current search_path: %', current_setting('search_path');
END $$;