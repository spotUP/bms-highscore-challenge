-- Simple fix for user roles - works with any table structure
-- Run this in your Supabase SQL Editor

-- First, clean up any bad data
DELETE FROM user_roles WHERE user_id IS NULL OR role IS NULL;

-- Check your user info first (replace with your actual email)
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Simple insert without optional columns - replace 'your-email@example.com' with your actual email
-- Uncomment the line below and modify it:
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ((SELECT id FROM auth.users WHERE email = 'your-email@example.com'), 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Check the result
SELECT 'User roles setup complete!' as status;
SELECT u.email, COALESCE(ur.role, 'user') as role
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
ORDER BY ur.role DESC NULLS LAST, u.email;
