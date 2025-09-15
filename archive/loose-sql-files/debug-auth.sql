-- Check if auth.uid() is working
SELECT auth.role() as current_role, 
       auth.uid() as user_id;

-- List all user roles (this should work if you're an admin)
SELECT * FROM user_roles;

-- List your own roles (this should always work)
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- Check if you're an admin
SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
) as is_admin;