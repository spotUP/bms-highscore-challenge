-- Restore Working Achievement System (Adapted for Multi-Tournament)
-- Based on the original simple achievement system that was working

-- Step 1: Disable RLS for setup
ALTER TABLE achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements DISABLE ROW LEVEL SECURITY;

-- Step 2: Add missing columns to achievements table if they don't exist
DO $$
BEGIN
    -- Add badge_icon column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'badge_icon') THEN
        ALTER TABLE achievements ADD COLUMN badge_icon TEXT DEFAULT '🏆';
    END IF;
    
    -- Add badge_color column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'badge_color') THEN
        ALTER TABLE achievements ADD COLUMN badge_color TEXT DEFAULT '#FFD700';
    END IF;
    
    -- Add points column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'points') THEN
        ALTER TABLE achievements ADD COLUMN points INTEGER DEFAULT 10;
    END IF;
END $$;

-- Step 3: Add tournament_id column to player_achievements if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_achievements' AND column_name = 'tournament_id') THEN
        ALTER TABLE player_achievements ADD COLUMN tournament_id UUID REFERENCES tournaments(id);
        -- Set existing records to the current tournament
        UPDATE player_achievements SET tournament_id = '72e5cd46-2fab-4c20-bcd0-f4d84346ec26' WHERE tournament_id IS NULL;
        -- Make it required for new records
        ALTER TABLE player_achievements ALTER COLUMN tournament_id SET NOT NULL;
    END IF;
END $$;

-- Step 4: Clear and insert achievements for the current tournament
DELETE FROM achievements WHERE tournament_id = '72e5cd46-2fab-4c20-bcd0-f4d84346ec26';

INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria, tournament_id) VALUES
('First Score', 'Submit your first score', 'first_score', '🎯', '#00ff00', 10, '{"condition": "score_threshold", "value": 1}', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'),
('Century Club', 'Score 100 points or more', 'score_milestone', '💯', '#ff6b6b', 25, '{"condition": "score_threshold", "value": 100}', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'),
('High Scorer', 'Score 1,000 points or more', 'high_scorer', '🔥', '#4ecdc4', 50, '{"condition": "score_threshold", "value": 1000}', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'),
('Score Hunter', 'Score 10,000 points or more', 'high_scorer', '⭐', '#45b7d1', 100, '{"condition": "score_threshold", "value": 10000}', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'),
('Perfect Game', 'Score 50,000 points or more', 'perfectionist', '💎', '#f39c12', 250, '{"condition": "score_threshold", "value": 50000}', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'),
('Score Legend', 'Score 100,000 points or more', 'perfectionist', '👑', '#e74c3c', 500, '{"condition": "score_threshold", "value": 100000}', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26');

-- Step 5: Create the working achievement trigger function (multi-tournament adapted)
CREATE OR REPLACE FUNCTION award_achievements()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update player stats (keep existing logic)
    INSERT INTO player_stats (
        player_name,
        tournament_id,
        total_scores,
        total_games_played,
        highest_score,
        first_place_count,
        total_competitions,
        current_streak,
        longest_streak,
        last_score_date
    )
    VALUES (
        NEW.player_name,
        NEW.tournament_id,
        1,
        1,
        NEW.score,
        0,
        1,
        1,
        1,
        NOW()
    )
    ON CONFLICT (player_name) DO UPDATE SET
        total_scores = player_stats.total_scores + 1,
        total_games_played = player_stats.total_games_played + 1,
        highest_score = GREATEST(player_stats.highest_score, NEW.score),
        last_score_date = NOW(),
        updated_at = NOW(),
        tournament_id = NEW.tournament_id;

    -- Award "First Score" achievement
    IF NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'First Score'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'First Score' AND a.tournament_id = NEW.tournament_id;
    END IF;

    -- Award "Century Club" achievement if score >= 100
    IF NEW.score >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'Century Club'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'Century Club' AND a.tournament_id = NEW.tournament_id;
    END IF;

    -- Award "High Scorer" achievement if score >= 1000
    IF NEW.score >= 1000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'High Scorer'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'High Scorer' AND a.tournament_id = NEW.tournament_id;
    END IF;

    -- Award "Score Hunter" achievement if score >= 10000
    IF NEW.score >= 10000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'Score Hunter'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'Score Hunter' AND a.tournament_id = NEW.tournament_id;
    END IF;

    -- Award "Perfect Game" achievement if score >= 50000
    IF NEW.score >= 50000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'Perfect Game'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'Perfect Game' AND a.tournament_id = NEW.tournament_id;
    END IF;

    -- Award "Score Legend" achievement if score >= 100000
    IF NEW.score >= 100000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'Score Legend'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'Score Legend' AND a.tournament_id = NEW.tournament_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create the RPC function for the frontend to check achievements
CREATE OR REPLACE FUNCTION get_recent_achievements(
    p_player_name TEXT,
    p_since_minutes INTEGER DEFAULT 1
)
RETURNS TABLE (
    achievement_id UUID,
    achievement_name TEXT,
    achievement_description TEXT,
    badge_icon TEXT,
    badge_color TEXT,
    points INTEGER,
    unlocked_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as achievement_id,
        a.name as achievement_name,
        a.description as achievement_description,
        a.badge_icon,
        a.badge_color,
        a.points,
        pa.unlocked_at
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.player_name = p_player_name
    AND pa.unlocked_at >= NOW() - (p_since_minutes || ' minutes')::INTERVAL
    ORDER BY pa.unlocked_at DESC;
END;
$$;

-- Step 7: Recreate the trigger (make sure it's connected)
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores;
CREATE TRIGGER award_achievements_trigger
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION award_achievements();

SELECT 'Multi-tournament achievement system restored and ready!' as status;
