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

-- Create a simple policy for reading roles
CREATE POLICY "read_own_and_admin_roles" ON user_roles FOR SELECT 
USING (
    -- Can read own records
    user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
    OR 
    -- Admins can read all records
    EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
        AND role::text = 'admin'
    )
);

-- Simple policy for admins to manage roles
CREATE POLICY "admin_manage_roles" ON user_roles 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
        AND role::text = 'admin'
    )
);

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Grant basic permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_roles TO authenticated;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON user_roles(user_id, role);

-- Analyze for query planner
ANALYZE user_roles;

-- Debug: Show current table structure and roles
SELECT c.column_name, c.data_type, 
       CASE WHEN t.typtype = 'e' THEN 'enum' ELSE c.data_type END as actual_type,
       CASE WHEN t.typtype = 'e' THEN 
         (SELECT string_agg(e.enumlabel, ', ') 
          FROM pg_enum e 
          WHERE e.enumtypid = t.oid)
       END as enum_values
FROM information_schema.columns c
LEFT JOIN pg_type t ON t.typname = c.udt_name
WHERE c.table_name = 'user_roles'
ORDER BY c.ordinal_position;