-- First, ensure all necessary roles exist
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

-- Create a simple policy that uses Supabase's auth.uid() directly
CREATE POLICY "allow_read_own_or_admin" ON user_roles FOR SELECT
USING (
  user_id = auth.uid() -- Can read own records
  OR 
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create a policy for inserts (only admins can create new roles)
CREATE POLICY "allow_insert_admin" ON user_roles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create a policy for updates (only admins can update roles)
CREATE POLICY "allow_update_admin" ON user_roles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create a policy for deletes (only admins can delete roles)
CREATE POLICY "allow_delete_admin" ON user_roles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON user_roles(user_id, role);

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON user_roles TO authenticated;

-- Make sure we have an admin user
INSERT INTO user_roles (user_id, role)
VALUES ('0f0672de-6b1a-49e1-8857-41fef18dc6f8', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Analyze the table
ANALYZE user_roles;

-- Create direct policies on user_roles table
CREATE POLICY "view_own_roles" ON user_roles
FOR ALL
USING (
    -- Direct user match
    user_id::text = COALESCE(
        current_setting('request.jwt.claims', true)::jsonb->>'sub',
        current_setting('request.headers', true)::jsonb->>'x-user-id',
        'no-user'
    )
    OR
    -- Admin check
    EXISTS (
        SELECT 1 
        FROM user_roles ur 
        WHERE ur.user_id::text = COALESCE(
            current_setting('request.jwt.claims', true)::jsonb->>'sub',
            current_setting('request.headers', true)::jsonb->>'x-user-id',
            'no-user'
        )
        AND ur.role = 'admin'
    )
);

-- Create index on admin_users
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- Function to sync admin status
CREATE OR REPLACE FUNCTION sync_admin_status()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Clean up admin_users table
    DELETE FROM admin_users WHERE user_id NOT IN (
        SELECT user_id FROM user_roles WHERE role = 'admin'
    );
    
    -- Insert new admins
    INSERT INTO admin_users (user_id)
    SELECT DISTINCT user_id
    FROM user_roles
    WHERE role = 'admin'
    AND user_id NOT IN (SELECT user_id FROM admin_users)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NULL;
END;
$$;

-- Create trigger for admin sync
DROP TRIGGER IF EXISTS sync_admin_status_trigger ON user_roles;
CREATE TRIGGER sync_admin_status_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON user_roles
    FOR EACH STATEMENT
    EXECUTE FUNCTION sync_admin_status();

-- Create a function to get the current user with fallback
CREATE OR REPLACE FUNCTION get_current_user()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    -- First try auth.uid(), if null use request.jwt.claims->>'sub'
    SELECT COALESCE(
        auth.uid(),
        (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
    );
$$;

-- Create a simplified access control function
CREATE OR REPLACE FUNCTION check_user_role_access(check_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
STABLE
LANGUAGE plpgsql
AS $$
DECLARE
    requesting_user UUID;
BEGIN
    requesting_user := get_current_user();
    
    -- If we still can't get the user ID, default to most restrictive
    IF requesting_user IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Allow access if it's the user's own record
    IF check_user_id = requesting_user THEN
        RETURN TRUE;
    END IF;
    
    -- Check admin status from admin_users table (no RLS)
    RETURN EXISTS (
        SELECT 1
        FROM admin_users
        WHERE user_id = requesting_user
    );
END;
$$;

-- Create a simple policy using the admin check
CREATE POLICY "user_roles_basic_policy"
ON user_roles
FOR ALL
USING (
    check_user_role_access(user_id)
);

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON admin_users TO authenticated;

-- Create function for initial admin sync
CREATE OR REPLACE FUNCTION initialize_admin_users()
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Clean up admin_users table
    DELETE FROM admin_users;
    
    -- Insert all current admins
    INSERT INTO admin_users (user_id)
    SELECT DISTINCT user_id
    FROM user_roles
    WHERE role = 'admin';
END;
$$;

-- Perform initial sync
SELECT initialize_admin_users();

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON user_roles(user_id, role);

-- Analyze the tables
ANALYZE user_roles;
ANALYZE admin_users;

-- Clean up (drop the initialization function as it's no longer needed)
DROP FUNCTION initialize_admin_users();