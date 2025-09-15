-- Fix the achievement system using the correct enum values
-- Run this in your Supabase SQL Editor

-- 1. Update existing achievements with proper type and criteria
UPDATE achievements SET 
    type = 'first_score',
    criteria = '{"condition": "score_threshold", "value": 1}'::jsonb
WHERE name = 'First Steps';

UPDATE achievements SET 
    type = 'first_place',
    criteria = '{"condition": "first_place", "value": 1}'::jsonb
WHERE name = 'Champion';

UPDATE achievements SET 
    type = 'score_milestone',
    criteria = '{"condition": "score_threshold", "value": 10000}'::jsonb
WHERE name = 'Score Hunter';

UPDATE achievements SET 
    type = 'score_milestone',
    criteria = '{"condition": "score_threshold", "value": 50000}'::jsonb
WHERE name = 'Score Master';

UPDATE achievements SET 
    type = 'score_milestone',
    criteria = '{"condition": "score_threshold", "value": 100000}'::jsonb
WHERE name = 'Score Legend';

-- 2. Add more achievements using the correct enum values
INSERT INTO achievements (name, description, type, badge_icon, badge_color, criteria, points) VALUES
-- Score-based achievements
('Century Club', 'Score 100 points or more', 'high_scorer', '💯', '#ff6b6b', '{"condition": "score_threshold", "value": 100}', 25),
('Half Grand', 'Score 500 points or more', 'high_scorer', '🔥', '#ffa500', '{"condition": "score_threshold", "value": 500}', 50),
('Grand Master', 'Score 1000 points or more', 'high_scorer', '👑', '#ffd700', '{"condition": "score_threshold", "value": 1000}', 100),
('High Roller', 'Score 5000 points or more', 'high_scorer', '🎰', '#9b59b6', '{"condition": "score_threshold", "value": 5000}', 200),

-- First place achievements
('First Victory', 'Win your first game', 'first_place', '🏆', '#f39c12', '{"condition": "first_place", "value": 1}', 50),
('Champion', 'Win 5 games', 'competition_winner', '🥇', '#e67e22', '{"condition": "first_place", "value": 5}', 150),
('Dominator', 'Win 10 games', 'competition_winner', '👑', '#d35400', '{"condition": "first_place", "value": 10}', 300),

-- Total scores achievements
('Getting Started', 'Submit 5 scores', 'consistent_player', '📝', '#3498db', '{"condition": "total_scores", "value": 5}', 25),
('Regular Player', 'Submit 25 scores', 'consistent_player', '🎮', '#2980b9', '{"condition": "total_scores", "value": 25}', 75),
('Dedicated Gamer', 'Submit 50 scores', 'consistent_player', '🎯', '#1abc9c', '{"condition": "total_scores", "value": 50}', 150),
('Score Master', 'Submit 100 scores', 'consistent_player', '🏅', '#16a085', '{"condition": "total_scores", "value": 100}', 300),

-- Streak achievements
('Hot Streak', 'Get a 3-game streak', 'streak_master', '🔥', '#e74c3c', '{"condition": "streak", "value": 3}', 50),
('On Fire', 'Get a 5-game streak', 'streak_master', '⚡', '#c0392b', '{"condition": "streak", "value": 5}', 100),
('Unstoppable', 'Get a 10-game streak', 'streak_master', '💥', '#8e44ad', '{"condition": "streak", "value": 10}', 250),

-- Game-based achievements
('Explorer', 'Play 3 different games', 'game_master', '🗺️', '#27ae60', '{"condition": "unique_games", "value": 3}', 50),
('Adventurer', 'Play 5 different games', 'game_master', '🏔️', '#2ecc71', '{"condition": "unique_games", "value": 5}', 100),
('Game Master', 'Play 10 different games', 'game_master', '🎲', '#1abc9c', '{"condition": "unique_games", "value": 10}', 200),
('Arcade Legend', 'Play 20 different games', 'game_master', '🎪', '#16a085', '{"condition": "unique_games", "value": 20}', 500);

-- 3. Create the update_player_stats function
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
        last_score_date = NEW.created_at,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the check_achievements_on_score function
CREATE OR REPLACE FUNCTION check_achievements_on_score()
RETURNS TRIGGER AS $$
DECLARE
    achievement_record RECORD;
    player_stats_record RECORD;
    condition_type TEXT;
    condition_value INTEGER;
BEGIN
    -- Get player stats
    SELECT * INTO player_stats_record 
    FROM player_stats 
    WHERE player_name = NEW.player_name;
    
    -- Check for achievements based on score
    FOR achievement_record IN 
        SELECT * FROM achievements 
        WHERE type IN ('first_score', 'high_scorer', 'score_milestone', 'first_place', 'competition_winner', 'consistent_player', 'streak_master')
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements 
            WHERE player_name = NEW.player_name 
            AND achievement_id = achievements.id
        )
    LOOP
        -- Extract condition from JSON
        condition_type := achievement_record.criteria->>'condition';
        condition_value := (achievement_record.criteria->>'value')::INTEGER;
        
        -- Check if achievement conditions are met
        IF (condition_type = 'score_threshold' AND NEW.score >= condition_value) OR
           (condition_type = 'first_place' AND player_stats_record.first_place_count >= condition_value) OR
           (condition_type = 'total_scores' AND player_stats_record.total_scores >= condition_value) OR
           (condition_type = 'streak' AND player_stats_record.current_streak >= condition_value) THEN
            
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

-- 5. Create the check_achievements_on_game_play function
CREATE OR REPLACE FUNCTION check_achievements_on_game_play()
RETURNS TRIGGER AS $$
DECLARE
    achievement_record RECORD;
    player_stats_record RECORD;
    condition_type TEXT;
    condition_value INTEGER;
BEGIN
    -- Get player stats
    SELECT * INTO player_stats_record 
    FROM player_stats 
    WHERE player_name = NEW.player_name;
    
    -- Check for achievements based on game play
    FOR achievement_record IN 
        SELECT * FROM achievements 
        WHERE type = 'game_master'
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements 
            WHERE player_name = NEW.player_name 
            AND achievement_id = achievements.id
        )
    LOOP
        -- Extract condition from JSON
        condition_type := achievement_record.criteria->>'condition';
        condition_value := (achievement_record.criteria->>'value')::INTEGER;
        
        -- Check if achievement conditions are met
        IF (condition_type = 'games_played' AND player_stats_record.total_games_played >= condition_value) OR
           (condition_type = 'unique_games' AND (
               SELECT COUNT(DISTINCT game_id) FROM scores WHERE player_name = NEW.player_name
           ) >= condition_value) THEN
            
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

-- 6. Create the triggers
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

-- 7. Test the system
INSERT INTO scores (player_name, score, game_id, created_at)
VALUES ('SYSTEM_TEST', 1500, (SELECT id FROM games LIMIT 1), NOW());

-- 8. Check if everything worked
SELECT 'Achievements Table' as table_name, COUNT(*) as count FROM achievements
UNION ALL
SELECT 'Player Stats Test' as table_name, COUNT(*) as count FROM player_stats WHERE player_name = 'SYSTEM_TEST'
UNION ALL
SELECT 'Player Achievements Test' as table_name, COUNT(*) as count FROM player_achievements WHERE player_name = 'SYSTEM_TEST';

-- 9. Clean up test data
DELETE FROM scores WHERE player_name = 'SYSTEM_TEST';
DELETE FROM player_stats WHERE player_name = 'SYSTEM_TEST';
DELETE FROM player_achievements WHERE player_name = 'SYSTEM_TEST';

-- 10. Show final status
SELECT 'Setup Complete!' as status, 
       (SELECT COUNT(*) FROM achievements) as achievements_created,
       (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE 'trigger_%' AND event_object_table = 'scores') as triggers_created;
