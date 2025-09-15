-- Check all columns in the achievements table
-- Run this in your Supabase SQL Editor

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'achievements' 
AND table_schema = 'public'
ORDER BY ordinal_position;
