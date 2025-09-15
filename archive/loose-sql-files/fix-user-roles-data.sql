-- Fix user roles data and set up admin user
-- Run this in your Supabase SQL Editor

-- First, clean up any bad data
DELETE FROM user_roles WHERE user_id IS NULL OR role IS NULL;

-- Check your user ID and email (replace 'your-email@example.com' with your actual email)
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- To make yourself admin, uncomment and modify the line below with your actual email:
-- INSERT INTO user_roles (user_id, role, created_at, updated_at) 
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'your-email@example.com'), 
--   'admin',
--   NOW(),
--   NOW()
-- )
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin', updated_at = NOW();

-- Verify the setup
SELECT 'User roles cleaned and ready!' as status;
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
ORDER BY ur.role DESC, u.email;
