-- Add harder achievements to the achievement system
-- Run this in your Supabase SQL Editor to add more challenging achievements

-- Add new achievements (only if they don't exist)
DO $$
BEGIN
    -- Extreme Score Achievements
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Demolisher') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Score Demolisher', 'Score 50,000+ points in a single game', '💥', '#e74c3c', 500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score God') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Score God', 'Score 100,000+ points in a single game', '⚡', '#8e44ad', 1000);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Apocalypse') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Score Apocalypse', 'Score 250,000+ points in a single game', '🌟', '#2c3e50', 2500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Infinity') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Score Infinity', 'Score 500,000+ points in a single game', '♾️', '#1abc9c', 5000);
    END IF;
    
    -- Multi-Game Mastery Achievements
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Game Explorer') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Game Explorer', 'Submit scores for 5 different games', '🗺️', '#3498db', 150);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Game Conqueror') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Game Conqueror', 'Submit scores for 10 different games', '⚔️', '#e67e22', 300);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Game Emperor') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Game Emperor', 'Submit scores for 15 different games', '👨‍💼', '#9b59b6', 500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Arcade Legend') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Arcade Legend', 'Submit scores for 25 different games', '🏛️', '#34495e', 1000);
    END IF;
    
    -- Volume-based Achievements
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Machine') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Score Machine', 'Submit 25 total scores', '🔧', '#16a085', 100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Factory') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Score Factory', 'Submit 50 total scores', '🏭', '#27ae60', 200);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Empire') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Score Empire', 'Submit 100 total scores', '🏰', '#f39c12', 500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Universe') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Score Universe', 'Submit 250 total scores', '🌌', '#2980b9', 1250);
    END IF;
    
    -- Dominance Achievements  
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Multi Champion') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Multi Champion', 'Get first place in 3 different games', '🎖️', '#d35400', 750);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Dominator') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Dominator', 'Get first place in 5 different games', '👑', '#c0392b', 1500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Supreme Overlord') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Supreme Overlord', 'Get first place in 10 different games', '🔱', '#8b0000', 3000);
    END IF;
    
    -- Consistency Achievements
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Consistent Performer') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Consistent Performer', 'Score 5,000+ points in 5 different games', '📊', '#7f8c8d', 400);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Reliability Expert') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Reliability Expert', 'Score 10,000+ points in 5 different games', '🎯', '#95a5a6', 800);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Perfection Master') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Perfection Master', 'Score 25,000+ points in 10 different games', '💎', '#bdc3c7', 2000);
    END IF;
    
    -- Elite Time-Based Achievements
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Weekend Warrior') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Weekend Warrior', 'Submit 10 scores in a single day', '⏰', '#f1c40f', 300);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Marathon Player') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Marathon Player', 'Submit 25 scores in a single day', '🏃‍♂️', '#e8c547', 750);
    END IF;
    
    -- Special Milestone Achievements
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Point Collector') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Point Collector', 'Accumulate 1,000 achievement points total', '💰', '#f7dc6f', 500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Point Magnate') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Point Magnate', 'Accumulate 5,000 achievement points total', '💸', '#f4d03f', 1000);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Point Emperor') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Point Emperor', 'Accumulate 10,000 achievement points total', '🏦', '#f1c40f', 2000);
    END IF;

END $$;

-- Update the achievement trigger function to handle the new achievements
CREATE OR REPLACE FUNCTION award_first_score_achievement()
RETURNS TRIGGER AS $$
DECLARE
    player_total_scores INTEGER;
    player_unique_games INTEGER;
    player_total_points INTEGER;
    player_first_places INTEGER;
    player_high_score_games INTEGER;
    player_consistent_games INTEGER;
    player_perfection_games INTEGER;
    scores_today INTEGER;
BEGIN
    -- Update or insert player stats
    IF EXISTS (SELECT 1 FROM player_stats WHERE player_name = NEW.player_name) THEN
        UPDATE player_stats SET
            total_scores = total_scores + 1,
            highest_score = GREATEST(highest_score, NEW.score),
            last_score_date = NEW.created_at,
            updated_at = NOW()
        WHERE player_name = NEW.player_name;
    ELSE
        INSERT INTO player_stats (player_name, total_scores, highest_score, last_score_date, updated_at)
        VALUES (NEW.player_name, 1, NEW.score, NEW.created_at, NOW());
    END IF;

    -- Get player statistics for achievement checking
    SELECT total_scores INTO player_total_scores 
    FROM player_stats WHERE player_name = NEW.player_name;
    
    -- Count unique games played
    SELECT COUNT(DISTINCT game_id) INTO player_unique_games 
    FROM scores WHERE player_name = NEW.player_name;
    
    -- Count total achievement points
    SELECT COALESCE(SUM(a.points), 0) INTO player_total_points
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.player_name = NEW.player_name;
    
    -- Count first places (rank = 1)
    SELECT COUNT(*) INTO player_first_places
    FROM (
        SELECT DISTINCT game_id
        FROM scores s1
        WHERE s1.player_name = NEW.player_name
        AND s1.score = (SELECT MAX(s2.score) FROM scores s2 WHERE s2.game_id = s1.game_id)
    ) subq;
    
    -- Count games with 5000+ points
    SELECT COUNT(DISTINCT game_id) INTO player_high_score_games
    FROM scores 
    WHERE player_name = NEW.player_name AND score >= 5000;
    
    -- Count games with 10000+ points
    SELECT COUNT(DISTINCT game_id) INTO player_consistent_games
    FROM scores 
    WHERE player_name = NEW.player_name AND score >= 10000;
    
    -- Count games with 25000+ points
    SELECT COUNT(DISTINCT game_id) INTO player_perfection_games
    FROM scores 
    WHERE player_name = NEW.player_name AND score >= 25000;
    
    -- Count scores submitted today
    SELECT COUNT(*) INTO scores_today
    FROM scores 
    WHERE player_name = NEW.player_name 
    AND DATE(created_at) = CURRENT_DATE;

    -- Award basic achievements (existing logic)
    IF NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'First Score'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'First Score';
    END IF;

    -- Score milestone achievements
    IF NEW.score >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Century Club'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Century Club';
    END IF;

    IF NEW.score >= 1000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'High Scorer'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'High Scorer';
    END IF;

    IF NEW.score >= 10000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Score Hunter'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Score Hunter';
    END IF;

    -- NEW HARDER ACHIEVEMENTS

    -- Extreme Score Achievements
    IF NEW.score >= 50000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Score Demolisher'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Score Demolisher';
    END IF;

    IF NEW.score >= 100000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Score God'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Score God';
    END IF;

    IF NEW.score >= 250000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Score Apocalypse'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Score Apocalypse';
    END IF;

    IF NEW.score >= 500000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Score Infinity'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Score Infinity';
    END IF;

    -- Multi-Game Achievements
    IF player_unique_games >= 5 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Game Explorer'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Game Explorer';
    END IF;

    IF player_unique_games >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Game Conqueror'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Game Conqueror';
    END IF;

    IF player_unique_games >= 15 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Game Emperor'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Game Emperor';
    END IF;

    IF player_unique_games >= 25 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Arcade Legend'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Arcade Legend';
    END IF;

    -- Volume-based Achievements
    IF player_total_scores >= 25 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Score Machine'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Score Machine';
    END IF;

    IF player_total_scores >= 50 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Score Factory'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Score Factory';
    END IF;

    IF player_total_scores >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Score Empire'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Score Empire';
    END IF;

    IF player_total_scores >= 250 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Score Universe'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Score Universe';
    END IF;

    -- Dominance Achievements (First Places)
    IF player_first_places >= 3 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Multi Champion'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Multi Champion';
    END IF;

    IF player_first_places >= 5 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Dominator'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Dominator';
    END IF;

    IF player_first_places >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Supreme Overlord'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Supreme Overlord';
    END IF;

    -- Consistency Achievements
    IF player_high_score_games >= 5 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Consistent Performer'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Consistent Performer';
    END IF;

    IF player_consistent_games >= 5 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Reliability Expert'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Reliability Expert';
    END IF;

    IF player_perfection_games >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Perfection Master'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Perfection Master';
    END IF;

    -- Time-based Achievements
    IF scores_today >= 10 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Weekend Warrior'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Weekend Warrior';
    END IF;

    IF scores_today >= 25 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Marathon Player'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Marathon Player';
    END IF;

    -- Point Accumulation Achievements (check after this potential new achievement)
    -- Recalculate total points including any new achievements just awarded
    SELECT COALESCE(SUM(a.points), 0) INTO player_total_points
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.player_name = NEW.player_name;

    IF player_total_points >= 1000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Point Collector'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Point Collector';
    END IF;

    IF player_total_points >= 5000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Point Magnate'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Point Magnate';
    END IF;

    IF player_total_points >= 10000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name AND a.name = 'Point Emperor'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id FROM achievements a WHERE a.name = 'Point Emperor';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the setup
SELECT 'Harder achievements added successfully!' as status;
SELECT COUNT(*) as total_achievements FROM achievements;
