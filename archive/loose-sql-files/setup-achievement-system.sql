-- Complete Achievement System Setup
-- Run this in your Supabase SQL Editor

-- 1. Create the achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    badge_icon VARCHAR(10) NOT NULL,
    badge_color VARCHAR(7) NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    achievement_type VARCHAR(50) NOT NULL CHECK (achievement_type IN ('score_based', 'game_based', 'streak_based')),
    condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('score_threshold', 'first_place', 'total_scores', 'streak', 'games_played', 'unique_games')),
    condition_value INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create the player_achievements table
CREATE TABLE IF NOT EXISTS player_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_name VARCHAR(255) NOT NULL,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_name, achievement_id)
);

-- 3. Create the player_stats table
CREATE TABLE IF NOT EXISTS player_stats (
    player_name VARCHAR(255) PRIMARY KEY,
    total_scores INTEGER DEFAULT 0,
    highest_score INTEGER DEFAULT 0,
    first_place_count INTEGER DEFAULT 0,
    total_games_played INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_score_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Insert sample achievements
INSERT INTO achievements (name, description, badge_icon, badge_color, points, achievement_type, condition_type, condition_value) VALUES
-- Score-based achievements
('First Score', 'Submit your first score', '🎯', '#00ff00', 10, 'score_based', 'score_threshold', 1),
('Century Club', 'Score 100 points or more', '💯', '#ff6b6b', 25, 'score_based', 'score_threshold', 100),
('Half Grand', 'Score 500 points or more', '🔥', '#ffa500', 50, 'score_based', 'score_threshold', 500),
('Grand Master', 'Score 1000 points or more', '👑', '#ffd700', 100, 'score_based', 'score_threshold', 1000),
('High Roller', 'Score 5000 points or more', '🎰', '#9b59b6', 200, 'score_based', 'score_threshold', 5000),
('Legendary', 'Score 10000 points or more', '🌟', '#e74c3c', 500, 'score_based', 'score_threshold', 10000),

-- First place achievements
('First Victory', 'Win your first game', '🏆', '#f39c12', 50, 'score_based', 'first_place', 1),
('Champion', 'Win 5 games', '🥇', '#e67e22', 150, 'score_based', 'first_place', 5),
('Dominator', 'Win 10 games', '👑', '#d35400', 300, 'score_based', 'first_place', 10),

-- Total scores achievements
('Getting Started', 'Submit 5 scores', '📝', '#3498db', 25, 'score_based', 'total_scores', 5),
('Regular Player', 'Submit 25 scores', '🎮', '#2980b9', 75, 'score_based', 'total_scores', 25),
('Dedicated Gamer', 'Submit 50 scores', '🎯', '#1abc9c', 150, 'score_based', 'total_scores', 50),
('Score Master', 'Submit 100 scores', '🏅', '#16a085', 300, 'score_based', 'total_scores', 100),

-- Streak achievements
('Hot Streak', 'Get a 3-game streak', '🔥', '#e74c3c', 50, 'score_based', 'streak', 3),
('On Fire', 'Get a 5-game streak', '⚡', '#c0392b', 100, 'score_based', 'streak', 5),
('Unstoppable', 'Get a 10-game streak', '💥', '#8e44ad', 250, 'score_based', 'streak', 10),

-- Game-based achievements
('Explorer', 'Play 3 different games', '🗺️', '#27ae60', 50, 'game_based', 'unique_games', 3),
('Adventurer', 'Play 5 different games', '🏔️', '#2ecc71', 100, 'game_based', 'unique_games', 5),
('Game Master', 'Play 10 different games', '🎲', '#1abc9c', 200, 'game_based', 'unique_games', 10),
('Arcade Legend', 'Play 20 different games', '🎪', '#16a085', 500, 'game_based', 'unique_games', 20);

-- 5. Create the update_player_stats function
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

-- 6. Create the check_achievements_on_score function
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

-- 7. Create the check_achievements_on_game_play function
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

-- 8. Create the triggers
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

-- 9. Test the system
INSERT INTO scores (player_name, score, game_id, created_at)
VALUES ('SYSTEM_TEST', 1500, (SELECT id FROM games LIMIT 1), NOW());

-- 10. Check if everything worked
SELECT 'Achievements Table' as table_name, COUNT(*) as count FROM achievements
UNION ALL
SELECT 'Player Stats Test' as table_name, COUNT(*) as count FROM player_stats WHERE player_name = 'SYSTEM_TEST'
UNION ALL
SELECT 'Player Achievements Test' as table_name, COUNT(*) as count FROM player_achievements WHERE player_name = 'SYSTEM_TEST';

-- 11. Clean up test data
DELETE FROM scores WHERE player_name = 'SYSTEM_TEST';
DELETE FROM player_stats WHERE player_name = 'SYSTEM_TEST';
DELETE FROM player_achievements WHERE player_name = 'SYSTEM_TEST';

-- 12. Show final status
SELECT 'Setup Complete!' as status, 
       (SELECT COUNT(*) FROM achievements) as achievements_created,
       (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE 'trigger_%' AND event_object_table = 'scores') as triggers_created;
