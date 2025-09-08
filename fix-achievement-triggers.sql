-- Fix achievement triggers if they're missing or broken
-- Run this in your Supabase SQL Editor

-- First, drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_check_achievements_on_score ON scores;
DROP TRIGGER IF EXISTS trigger_check_achievements_on_game_play ON scores;
DROP TRIGGER IF EXISTS trigger_update_player_stats ON scores;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS check_achievements_on_score();
DROP FUNCTION IF EXISTS check_achievements_on_game_play();
DROP FUNCTION IF EXISTS update_player_stats();

-- Recreate the update_player_stats function
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
DECLARE
    player_rank INTEGER;
    is_first_place BOOLEAN := FALSE;
BEGIN
    -- Calculate the player's rank for this game
    SELECT COUNT(*) + 1 INTO player_rank
    FROM scores 
    WHERE game_id = NEW.game_id 
    AND score > NEW.score;
    
    -- Check if this is first place
    IF player_rank = 1 THEN
        is_first_place := TRUE;
    END IF;
    
    -- Insert or update player stats
    INSERT INTO player_stats (
        player_name,
        total_scores,
        highest_score,
        first_place_count,
        total_games_played,
        current_streak,
        longest_streak,
        last_score_date
    ) VALUES (
        NEW.player_name,
        1,
        NEW.score,
        CASE WHEN is_first_place THEN 1 ELSE 0 END,
        1,
        1,
        1,
        NEW.created_at
    )
    ON CONFLICT (player_name) DO UPDATE SET
        total_scores = player_stats.total_scores + 1,
        highest_score = GREATEST(player_stats.highest_score, NEW.score),
        first_place_count = player_stats.first_place_count + CASE WHEN is_first_place THEN 1 ELSE 0 END,
        total_games_played = player_stats.total_games_played + 1,
        current_streak = CASE 
            WHEN player_stats.last_score_date::date = NEW.created_at::date - INTERVAL '1 day' 
            THEN player_stats.current_streak + 1 
            ELSE 1 
        END,
        longest_streak = GREATEST(
            player_stats.longest_streak,
            CASE 
                WHEN player_stats.last_score_date::date = NEW.created_at::date - INTERVAL '1 day' 
                THEN player_stats.current_streak + 1 
                ELSE 1 
            END
        ),
        last_score_date = NEW.created_at;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the check_achievements_on_score function
CREATE OR REPLACE FUNCTION check_achievements_on_score()
RETURNS TRIGGER AS $$
DECLARE
    achievement_record RECORD;
    player_stats_record RECORD;
BEGIN
    -- Get player stats
    SELECT * INTO player_stats_record 
    FROM player_stats 
    WHERE player_name = NEW.player_name;
    
    -- Check for achievements based on score
    FOR achievement_record IN 
        SELECT * FROM achievements 
        WHERE achievement_type = 'score_based'
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements 
            WHERE player_name = NEW.player_name 
            AND achievement_id = achievements.id
        )
    LOOP
        -- Check if achievement conditions are met
        IF (achievement_record.condition_type = 'score_threshold' AND NEW.score >= achievement_record.condition_value) OR
           (achievement_record.condition_type = 'first_place' AND player_stats_record.first_place_count >= achievement_record.condition_value) OR
           (achievement_record.condition_type = 'total_scores' AND player_stats_record.total_scores >= achievement_record.condition_value) OR
           (achievement_record.condition_type = 'streak' AND player_stats_record.current_streak >= achievement_record.condition_value) THEN
            
            -- Award the achievement
            INSERT INTO player_achievements (player_name, achievement_id, unlocked_at)
            VALUES (NEW.player_name, achievement_record.id, NOW());
            
            -- Log the achievement unlock
            RAISE NOTICE 'Achievement unlocked: % for player %', achievement_record.name, NEW.player_name;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the check_achievements_on_game_play function
CREATE OR REPLACE FUNCTION check_achievements_on_game_play()
RETURNS TRIGGER AS $$
DECLARE
    achievement_record RECORD;
    player_stats_record RECORD;
BEGIN
    -- Get player stats
    SELECT * INTO player_stats_record 
    FROM player_stats 
    WHERE player_name = NEW.player_name;
    
    -- Check for achievements based on game play
    FOR achievement_record IN 
        SELECT * FROM achievements 
        WHERE achievement_type = 'game_based'
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements 
            WHERE player_name = NEW.player_name 
            AND achievement_id = achievements.id
        )
    LOOP
        -- Check if achievement conditions are met
        IF (achievement_record.condition_type = 'games_played' AND player_stats_record.total_games_played >= achievement_record.condition_value) OR
           (achievement_record.condition_type = 'unique_games' AND (
               SELECT COUNT(DISTINCT game_id) FROM scores WHERE player_name = NEW.player_name
           ) >= achievement_record.condition_value) THEN
            
            -- Award the achievement
            INSERT INTO player_achievements (player_name, achievement_id, unlocked_at)
            VALUES (NEW.player_name, achievement_record.id, NOW());
            
            -- Log the achievement unlock
            RAISE NOTICE 'Achievement unlocked: % for player %', achievement_record.name, NEW.player_name;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
CREATE TRIGGER trigger_update_player_stats
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION update_player_stats();

CREATE TRIGGER trigger_check_achievements_on_score
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION check_achievements_on_score();

CREATE TRIGGER trigger_check_achievements_on_game_play
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION check_achievements_on_game_play();

-- Test the triggers by inserting a test score
INSERT INTO scores (player_name, score, game_id, created_at)
VALUES ('TRIGGER_TEST', 5000, (SELECT id FROM games LIMIT 1), NOW());

-- Check if the test worked
SELECT 'Player Stats Test' as test_type, COUNT(*) as count FROM player_stats WHERE player_name = 'TRIGGER_TEST'
UNION ALL
SELECT 'Achievements Test' as test_type, COUNT(*) as count FROM player_achievements WHERE player_name = 'TRIGGER_TEST';

-- Clean up test data
DELETE FROM scores WHERE player_name = 'TRIGGER_TEST';
DELETE FROM player_stats WHERE player_name = 'TRIGGER_TEST';
DELETE FROM player_achievements WHERE player_name = 'TRIGGER_TEST';
