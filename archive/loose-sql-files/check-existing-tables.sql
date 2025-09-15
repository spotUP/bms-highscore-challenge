-- Check what columns exist in the achievements table
-- Run this in your Supabase SQL Editor

-- Check the structure of existing tables
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('achievements', 'player_achievements', 'player_stats')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Check if tables exist and have data
SELECT 'achievements' as table_name, COUNT(*) as row_count FROM achievements
UNION ALL
SELECT 'player_achievements' as table_name, COUNT(*) as row_count FROM player_achievements
UNION ALL
SELECT 'player_stats' as table_name, COUNT(*) as row_count FROM player_stats;
