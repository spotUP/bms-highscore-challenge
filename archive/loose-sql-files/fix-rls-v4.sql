-- Disable RLS temporarily
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

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requesting_user_id uuid;
BEGIN
    -- Get user ID from JWT claims
    requesting_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    
    -- Return false if no user ID found
    IF requesting_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Check if user has admin role
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = requesting_user_id 
        AND role = 'admin'::app_role
    );
END;
$$;

-- Create policies that align with your schema and use app_role enum
CREATE POLICY "Users can read own roles" ON user_roles
FOR SELECT
USING (
    user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
);

CREATE POLICY "Admins can read all roles" ON user_roles
FOR SELECT
USING (
    is_admin()
);

CREATE POLICY "Only admins can create roles" ON user_roles
FOR INSERT
WITH CHECK (
    CASE
        WHEN NEW.role = 'admin'::app_role THEN
            is_admin() -- Only admins can create admin roles
        ELSE
            true -- Anyone can create non-admin roles
    END
);

CREATE POLICY "Only admins can update roles" ON user_roles
FOR UPDATE
USING (
    is_admin()
);

CREATE POLICY "Only admins can delete roles" ON user_roles
FOR DELETE
USING (
    is_admin()
);

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON user_roles(user_id, role);

-- DEBUG: List all roles to verify setup
SELECT 
    r.user_id,
    r.role,
    r.created_at,
    u.email
FROM user_roles r
JOIN auth.users u ON r.user_id = u.id
ORDER BY r.created_at DESC;