-- Simple Achievement System Setup
-- This creates a basic achievement system that works with the webhook

-- 1. Create achievements table if it doesn't exist
CREATE TABLE IF NOT EXISTS achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    badge_icon TEXT NOT NULL DEFAULT '🏆',
    badge_color TEXT NOT NULL DEFAULT '#FFD700',
    points INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- 4. Insert basic achievements (only if they don't exist)
DO $$
BEGIN
    -- Insert achievements only if they don't already exist
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'First Score') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('First Score', 'Submit your very first score!', '🎯', '#00ff00', 10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Century Club') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Century Club', 'Score 100 points or more', '💯', '#ff6b6b', 25);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'High Scorer') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('High Scorer', 'Score 1,000 points or more', '🚀', '#ffd700', 50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Champion') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Champion', 'Achieve first place in any game', '👑', '#f39c12', 100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Score Hunter') THEN
        INSERT INTO achievements (name, description, badge_icon, badge_color, points) 
        VALUES ('Score Hunter', 'Score 10,000+ points in a single game', '🎖️', '#9b59b6', 200);
    END IF;
END $$;

-- 5. Create simple trigger function to award "First Score" achievement
CREATE OR REPLACE FUNCTION award_first_score_achievement()
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
    EXECUTE FUNCTION award_first_score_achievement();

-- 7. Enable RLS on new tables
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- 8. Create policies to allow read access
CREATE POLICY "Allow public read on achievements" ON achievements
    FOR SELECT USING (true);

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

-- Test the setup
SELECT 'Achievement system setup complete!' as status;
SELECT COUNT(*) as total_achievements FROM achievements;
