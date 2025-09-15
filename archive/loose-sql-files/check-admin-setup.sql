-- Check current admin users
SELECT * FROM admin_users;

-- Check user roles
SELECT * FROM user_roles;

-- Check specific user access
SELECT 
    check_user_role_access('0f0672de-6b1a-49e1-8857-41fef18dc6f8') as has_access,
    auth.uid() as current_user;