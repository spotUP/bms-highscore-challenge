-- Fix achievements admin page errors
-- This fixes the missing RPC functions and column issues

-- 1. Add missing 'type' column to achievements table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'achievements' AND column_name = 'type') THEN
        -- First, create the enum type if it doesn't exist
        DO $enum$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'achievement_type') THEN
                CREATE TYPE achievement_type AS ENUM (
                  'first_score',
                  'first_place',
                  'score_milestone',
                  'game_master',
                  'streak_master',
                  'competition_winner',
                  'high_scorer',
                  'consistent_player',
                  'speed_demon',
                  'perfectionist'
                );
            END IF;
        END $enum$;

        -- Add the type column
        ALTER TABLE achievements ADD COLUMN type achievement_type DEFAULT 'first_score';

        -- Update existing achievements with appropriate types based on their names
        UPDATE achievements SET type = 'first_score' WHERE name ILIKE '%first%steps%';
        UPDATE achievements SET type = 'first_place' WHERE name ILIKE '%champion%' OR name ILIKE '%winner%';
        UPDATE achievements SET type = 'score_milestone' WHERE name ILIKE '%score%hunter%' OR name ILIKE '%score%master%' OR name ILIKE '%score%legend%';
        UPDATE achievements SET type = 'game_master' WHERE name ILIKE '%game%explorer%' OR name ILIKE '%game%master%' OR name ILIKE '%game%legend%';
        UPDATE achievements SET type = 'high_scorer' WHERE name ILIKE '%high%roller%' OR name ILIKE '%elite%scorer%';
        UPDATE achievements SET type = 'consistent_player' WHERE name ILIKE '%regular%player%' OR name ILIKE '%dedicated%player%' OR name ILIKE '%loyal%player%';

        -- Make the column NOT NULL after updating
        ALTER TABLE achievements ALTER COLUMN type SET NOT NULL;

        RAISE NOTICE 'Added type column to achievements table';
    END IF;
END $$;

-- 2. Add missing columns if they don't exist
DO $$
BEGIN
    -- Add tournament_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'achievements' AND column_name = 'tournament_id') THEN
        ALTER TABLE achievements ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added tournament_id column to achievements table';
    END IF;

    -- Add created_by column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'achievements' AND column_name = 'created_by') THEN
        ALTER TABLE achievements ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added created_by column to achievements table';
    END IF;
END $$;

-- 3. Create missing RPC function: get_tournament_achievements
CREATE OR REPLACE FUNCTION get_tournament_achievements(p_tournament_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    type achievement_type,
    badge_icon TEXT,
    badge_color TEXT,
    criteria JSONB,
    points INTEGER,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    tournament_id UUID,
    created_by UUID,
    player_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.description,
        a.type,
        a.badge_icon,
        a.badge_color,
        a.criteria,
        a.points,
        a.is_active,
        a.created_at,
        a.updated_at,
        a.tournament_id,
        a.created_by,
        COALESCE(pa_count.player_count, 0) as player_count
    FROM achievements a
    LEFT JOIN (
        SELECT
            achievement_id,
            COUNT(DISTINCT player_name) as player_count
        FROM player_achievements
        WHERE tournament_id = p_tournament_id OR tournament_id IS NULL
        GROUP BY achievement_id
    ) pa_count ON a.id = pa_count.achievement_id
    WHERE
        a.tournament_id = p_tournament_id
        OR a.tournament_id IS NULL
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create function to get achievement statistics
CREATE OR REPLACE FUNCTION get_achievement_stats(p_tournament_id UUID)
RETURNS TABLE (
    achievement_id UUID,
    achievement_name TEXT,
    total_unlocks BIGINT,
    unique_players BIGINT,
    latest_unlock TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pa.achievement_id,
        a.name as achievement_name,
        COUNT(*) as total_unlocks,
        COUNT(DISTINCT pa.player_name) as unique_players,
        MAX(pa.unlocked_at) as latest_unlock
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.tournament_id = p_tournament_id OR pa.tournament_id IS NULL
    GROUP BY pa.achievement_id, a.name
    ORDER BY total_unlocks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update RLS policies to handle new columns properly
DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
CREATE POLICY "Anyone can view achievements" ON achievements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage achievements" ON achievements;
CREATE POLICY "Only admins can manage achievements" ON achievements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_achievements_tournament_id ON achievements(tournament_id);
CREATE INDEX IF NOT EXISTS idx_achievements_created_by ON achievements(created_by);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON achievements(type);
CREATE INDEX IF NOT EXISTS idx_player_achievements_tournament_id ON player_achievements(tournament_id);

-- 7. Ensure player_achievements table has tournament_id column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'player_achievements' AND column_name = 'tournament_id') THEN
        ALTER TABLE player_achievements ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

        -- Backfill tournament_id from scores table where possible
        UPDATE player_achievements pa
        SET tournament_id = s.tournament_id
        FROM scores s
        WHERE pa.game_id = s.game_id
        AND UPPER(pa.player_name) = UPPER(s.player_name)
        AND pa.tournament_id IS NULL;

        RAISE NOTICE 'Added tournament_id column to player_achievements table';
    END IF;
END $$;