-- Super simple admin setup - works with any table structure
-- Run this in your Supabase SQL Editor

-- Step 1: Check your user info (replace with your actual email)
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Step 2: Clean up any existing records for your user (optional)
-- Uncomment if you want to clean up first:
-- DELETE FROM user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- Step 3: Simple insert - replace 'your-email@example.com' with your actual email
-- Uncomment the line below and modify it:
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ((SELECT id FROM auth.users WHERE email = 'your-email@example.com'), 'admin');

-- Step 4: Verify it worked
SELECT 'Setup complete!' as status;
SELECT COUNT(*) as admin_count FROM user_roles WHERE role = 'admin';
SELECT * FROM user_roles WHERE role = 'admin';
