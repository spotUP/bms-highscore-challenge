-- Check the exact column structure of existing tables
-- Run this in your Supabase SQL Editor

-- Check the structure of existing tables
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('achievements', 'player_achievements', 'player_stats')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Also check what achievements already exist
SELECT id, name, description, badge_icon, badge_color, points FROM achievements LIMIT 5;
