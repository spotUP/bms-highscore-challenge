-- Fixed Achievement System Setup
-- This works with existing achievements table structure

-- 1. First, check the existing achievements table structure and add missing columns if needed
DO $$
BEGIN
    -- Add missing columns to achievements if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'badge_icon') THEN
        ALTER TABLE achievements ADD COLUMN badge_icon TEXT DEFAULT '🏆';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'badge_color') THEN
        ALTER TABLE achievements ADD COLUMN badge_color TEXT DEFAULT '#FFD700';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'points') THEN
        ALTER TABLE achievements ADD COLUMN points INTEGER DEFAULT 10;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'criteria') THEN
        ALTER TABLE achievements ADD COLUMN criteria JSONB DEFAULT '{}';
    END IF;
END $$;

-- 2. Create player_achievements table if it doesn't exist
CREATE TABLE IF NOT EXISTS player_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_name TEXT NOT NULL,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'player_achievements_unique_constraint'
    ) THEN
        ALTER TABLE player_achievements 
        ADD CONSTRAINT player_achievements_unique_constraint 
        UNIQUE (player_name, achievement_id);
    END IF;
END $$;

-- 3. Create player_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS player_stats (
    player_name TEXT PRIMARY KEY,
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

-- 4. Insert basic achievements (compatible with existing schema)
DO $$
DECLARE
    achievement_type_value TEXT;
BEGIN
    -- Determine what type value to use based on existing data
    SELECT type INTO achievement_type_value FROM achievements LIMIT 1;
    
    -- If we got a type value, use the existing pattern, otherwise use a default
    IF achievement_type_value IS NULL THEN
        achievement_type_value := 'score_based';
    END IF;
    
    -- Insert achievements only if they don't already exist
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'First Score') THEN
        INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
        VALUES ('First Score', 'Submit your very first score!', achievement_type_value::achievement_type, '🎯', '#00ff00', 10, '{"min_score": 1}');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Century Club') THEN
        INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
        VALUES ('Century Club', 'Score 100 points or more', achievement_type_value::achievement_type, '💯', '#ff6b6b', 25, '{"min_score": 100}');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'High Scorer') THEN
        INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
        VALUES ('High Scorer', 'Score 1,000 points or more', achievement_type_value::achievement_type, '🚀', '#ffd700', 50, '{"min_score": 1000}');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Champion') THEN
        INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
        VALUES ('Champion', 'Achieve first place in any game', achievement_type_value::achievement_type, '👑', '#f39c12', 100, '{"first_place": true}');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Hunter') THEN
        INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
        VALUES ('Score Hunter', 'Score 10,000+ points in a single game', achievement_type_value::achievement_type, '🎖️', '#9b59b6', 200, '{"min_score": 10000}');
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        -- If the enum casting fails, try with known enum values
        IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'First Score') THEN
            INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
            VALUES ('First Score', 'Submit your very first score!', 'first_score', '🎯', '#00ff00', 10, '{"min_score": 1}');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Century Club') THEN
            INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
            VALUES ('Century Club', 'Score 100 points or more', 'score_milestone', '💯', '#ff6b6b', 25, '{"min_score": 100}');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'High Scorer') THEN
            INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
            VALUES ('High Scorer', 'Score 1,000 points or more', 'high_scorer', '🚀', '#ffd700', 50, '{"min_score": 1000}');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Champion') THEN
            INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
            VALUES ('Champion', 'Achieve first place in any game', 'first_place', '👑', '#f39c12', 100, '{"first_place": true}');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Hunter') THEN
            INSERT INTO achievements (name, description, type, badge_icon, badge_color, points, criteria) 
            VALUES ('Score Hunter', 'Score 10,000+ points in a single game', 'high_scorer', '🎖️', '#9b59b6', 200, '{"min_score": 10000}');
        END IF;
END $$;

-- 5. Create simple trigger function to award achievements
CREATE OR REPLACE FUNCTION award_achievements()
RETURNS TRIGGER AS $$
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

    -- Award "First Score" achievement if this is their first score
    IF NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'First Score'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id
        FROM achievements a
        WHERE a.name = 'First Score';
    END IF;

    -- Award "Century Club" achievement if score >= 100
    IF NEW.score >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'Century Club'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id
        FROM achievements a
        WHERE a.name = 'Century Club';
    END IF;

    -- Award "High Scorer" achievement if score >= 1000
    IF NEW.score >= 1000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'High Scorer'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id
        FROM achievements a
        WHERE a.name = 'High Scorer';
    END IF;

    -- Award "Score Hunter" achievement if score >= 10000
    IF NEW.score >= 10000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'Score Hunter'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id)
        SELECT NEW.player_name, a.id
        FROM achievements a
        WHERE a.name = 'Score Hunter';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger on scores table
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores;
CREATE TRIGGER award_achievements_trigger
    AFTER INSERT OR UPDATE ON scores
    FOR EACH ROW
    EXECUTE FUNCTION award_achievements();

-- 7. Enable RLS on new tables
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- 8. Create policies to allow read access
CREATE POLICY "Allow public read on player_achievements" ON player_achievements
    FOR SELECT USING (true);

CREATE POLICY "Allow public read on player_stats" ON player_stats
    FOR SELECT USING (true);

-- Allow authenticated users to insert achievements and stats (for triggers)
CREATE POLICY "Allow authenticated insert on player_achievements" ON player_achievements
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated insert/update on player_stats" ON player_stats
    FOR ALL WITH CHECK (true);

-- 9. Create RPC function to get recent achievements for a player
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
        COALESCE(a.badge_icon, '🏆') as badge_icon,
        COALESCE(a.badge_color, '#FFD700') as badge_color,
        COALESCE(a.points, 10) as points,
        pa.unlocked_at
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.player_name = p_player_name
    AND pa.unlocked_at >= NOW() - (p_since_minutes || ' minutes')::INTERVAL
    ORDER BY pa.unlocked_at DESC;
END;
$$;

-- Test the setup
SELECT 'Achievement system setup complete!' as status;
SELECT COUNT(*) as total_achievements FROM achievements;
