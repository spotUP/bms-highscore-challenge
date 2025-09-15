-- Check the current structure of user_roles table
-- Run this in your Supabase SQL Editor

-- Check if user_roles table exists and what columns it has
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Also check what data is currently in the table
SELECT COUNT(*) as total_rows FROM user_roles;

-- Show any existing data
SELECT * FROM user_roles LIMIT 5;
