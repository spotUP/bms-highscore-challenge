-- Check if achievement triggers exist and are working
-- Run this in your Supabase SQL Editor

-- 1. Check if the achievement trigger functions exist
SELECT 
    routine_name, 
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name IN (
    'check_achievements_on_score',
    'check_achievements_on_game_play',
    'update_player_stats'
)
AND routine_schema = 'public';

-- 2. Check if the triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name IN (
    'trigger_check_achievements_on_score',
    'trigger_check_achievements_on_game_play',
    'trigger_update_player_stats'
)
AND event_object_schema = 'public';

-- 3. Check if the achievements table has data
SELECT COUNT(*) as achievement_count FROM achievements;

-- 4. Check if the player_achievements table exists
SELECT COUNT(*) as player_achievement_count FROM player_achievements;

-- 5. Check if the player_stats table exists
SELECT COUNT(*) as player_stats_count FROM player_stats;
