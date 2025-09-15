-- Final fix for achievements admin page errors
-- Run this after the previous fix to resolve remaining issues

-- 1. Fix missing badge_icon and badge_color columns
DO $$
BEGIN
    -- Add badge_icon column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'achievements' AND column_name = 'badge_icon') THEN
        ALTER TABLE achievements ADD COLUMN badge_icon TEXT DEFAULT '🏆';
        RAISE NOTICE 'Added badge_icon column to achievements table';
    END IF;

    -- Add badge_color column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'achievements' AND column_name = 'badge_color') THEN
        ALTER TABLE achievements ADD COLUMN badge_color TEXT DEFAULT '#FFD700';
        RAISE NOTICE 'Added badge_color column to achievements table';
    END IF;

    -- Add criteria column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'achievements' AND column_name = 'criteria') THEN
        ALTER TABLE achievements ADD COLUMN criteria JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added criteria column to achievements table';
    END IF;

    -- Add is_active column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'achievements' AND column_name = 'is_active') THEN
        ALTER TABLE achievements ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_active column to achievements table';
    END IF;

    -- Add updated_at column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'achievements' AND column_name = 'updated_at') THEN
        ALTER TABLE achievements ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to achievements table';
    END IF;
END $$;

-- 2. Fix the ambiguous tournament_id reference in the RPC function
DROP FUNCTION IF EXISTS get_tournament_achievements(UUID);

CREATE OR REPLACE FUNCTION get_tournament_achievements(p_tournament_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    type TEXT,  -- Changed from achievement_type to TEXT for compatibility
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
        CASE
            WHEN EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'achievements' AND column_name = 'type'
                        AND data_type = 'USER-DEFINED')
            THEN a.type::TEXT
            ELSE 'first_score'::TEXT
        END as type,
        COALESCE(a.badge_icon, '🏆') as badge_icon,
        COALESCE(a.badge_color, '#FFD700') as badge_color,
        COALESCE(a.criteria, '{}'::jsonb) as criteria,
        a.points,
        COALESCE(a.is_active, true) as is_active,
        a.created_at,
        COALESCE(a.updated_at, a.created_at) as updated_at,
        a.tournament_id,
        a.created_by,
        COALESCE(pa_count.player_count, 0) as player_count
    FROM achievements a
    LEFT JOIN (
        SELECT
            pa.achievement_id,
            COUNT(DISTINCT pa.player_name) as player_count
        FROM player_achievements pa
        WHERE pa.tournament_id = p_tournament_id OR pa.tournament_id IS NULL
        GROUP BY pa.achievement_id
    ) pa_count ON a.id = pa_count.achievement_id
    WHERE
        a.tournament_id = p_tournament_id
        OR a.tournament_id IS NULL
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a simpler version without type checking for compatibility
CREATE OR REPLACE FUNCTION get_tournament_achievements_simple(p_tournament_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
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
        COALESCE(a.badge_icon, '🏆') as badge_icon,
        COALESCE(a.badge_color, '#FFD700') as badge_color,
        COALESCE(a.criteria, '{}'::jsonb) as criteria,
        a.points,
        COALESCE(a.is_active, true) as is_active,
        a.created_at,
        COALESCE(a.updated_at, a.created_at) as updated_at,
        a.tournament_id,
        a.created_by,
        COALESCE(pa_count.player_count, 0) as player_count
    FROM achievements a
    LEFT JOIN (
        SELECT
            pa.achievement_id,
            COUNT(DISTINCT pa.player_name) as player_count
        FROM player_achievements pa
        WHERE pa.tournament_id = p_tournament_id OR pa.tournament_id IS NULL
        GROUP BY pa.achievement_id
    ) pa_count ON a.id = pa_count.achievement_id
    WHERE
        a.tournament_id = p_tournament_id
        OR a.tournament_id IS NULL
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update some sample achievement data with proper badge icons and colors
UPDATE achievements SET
    badge_icon = CASE
        WHEN name ILIKE '%first%' THEN '🎯'
        WHEN name ILIKE '%champion%' THEN '👑'
        WHEN name ILIKE '%score%' THEN '💯'
        WHEN name ILIKE '%game%' THEN '🎮'
        WHEN name ILIKE '%high%' THEN '💎'
        WHEN name ILIKE '%player%' THEN '📈'
        ELSE '🏆'
    END,
    badge_color = CASE
        WHEN name ILIKE '%champion%' THEN '#FFD700'
        WHEN name ILIKE '%legend%' THEN '#9C27B0'
        WHEN name ILIKE '%master%' THEN '#3F51B5'
        WHEN name ILIKE '%elite%' THEN '#009688'
        ELSE '#4CAF50'
    END
WHERE badge_icon IS NULL OR badge_color IS NULL;

-- 5. Ensure all necessary columns have NOT NULL constraints where appropriate
ALTER TABLE achievements ALTER COLUMN name SET NOT NULL;
ALTER TABLE achievements ALTER COLUMN description SET NOT NULL;
ALTER TABLE achievements ALTER COLUMN points SET NOT NULL;
ALTER TABLE achievements ALTER COLUMN points SET DEFAULT 10;

-- 6. Create or update indexes for better performance
CREATE INDEX IF NOT EXISTS idx_achievements_tournament_id ON achievements(tournament_id);
CREATE INDEX IF NOT EXISTS idx_achievements_created_by ON achievements(created_by);
CREATE INDEX IF NOT EXISTS idx_achievements_is_active ON achievements(is_active);
CREATE INDEX IF NOT EXISTS idx_player_achievements_tournament_id ON player_achievements(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_achievement_id ON player_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_player_name ON player_achievements(player_name);

-- 7. Grant proper permissions
GRANT EXECUTE ON FUNCTION get_tournament_achievements(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tournament_achievements(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_tournament_achievements_simple(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tournament_achievements_simple(UUID) TO anon;