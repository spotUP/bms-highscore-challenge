-- Add essential achievement system functions
-- This fixes the missing RPC functions that the frontend expects

-- Add missing columns to achievements table
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS badge_icon TEXT DEFAULT '🏆';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS badge_color TEXT DEFAULT '#FFD700';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'score_milestone';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS criteria JSONB DEFAULT '{}';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add missing columns to player_achievements table
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE player_achievements ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_player_achievements_user ON player_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_tournament ON player_achievements(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_unlocked_at ON player_achievements(unlocked_at);

-- RPC: get recent achievements by tournament and player_name (for anonymous users)
CREATE OR REPLACE FUNCTION get_recent_achievements_by_tournament(
    p_tournament_id UUID,
    p_player_name TEXT,
    p_since_minutes INTEGER DEFAULT 10
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
        a.points,
        COALESCE(pa.unlocked_at, pa.created_at) as unlocked_at
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.tournament_id = p_tournament_id
      AND UPPER(pa.player_name) = UPPER(p_player_name)
      AND COALESCE(pa.unlocked_at, pa.created_at) >= NOW() - (p_since_minutes || ' minutes')::INTERVAL
      AND pa.user_id IS NULL -- anonymous achievements only
    ORDER BY COALESCE(pa.unlocked_at, pa.created_at) DESC;
END;
$$;

-- RPC: get recent achievements for authenticated user
CREATE OR REPLACE FUNCTION get_recent_achievements_for_user(
    p_user_id UUID,
    p_tournament_id UUID,
    p_since_minutes INTEGER DEFAULT 10
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
        a.points,
        COALESCE(pa.unlocked_at, pa.created_at) as unlocked_at
    FROM player_achievements pa
    JOIN achievements a ON pa.achievement_id = a.id
    WHERE pa.tournament_id = p_tournament_id
      AND pa.user_id = p_user_id
      AND COALESCE(pa.unlocked_at, pa.created_at) >= NOW() - (p_since_minutes || ' minutes')::INTERVAL
      AND (a.created_by IS NULL OR a.created_by = p_user_id) -- only show achievements created by this user or public ones
    ORDER BY COALESCE(pa.unlocked_at, pa.created_at) DESC;
END;
$$;

-- Simple function to manually award achievements (for testing)
CREATE OR REPLACE FUNCTION award_achievement_to_player(
    p_player_name TEXT,
    p_tournament_id UUID,
    p_achievement_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if achievement already exists for this player
    IF EXISTS (
        SELECT 1 FROM player_achievements
        WHERE player_name = UPPER(p_player_name)
          AND tournament_id = p_tournament_id
          AND achievement_id = p_achievement_id
          AND (user_id = p_user_id OR (user_id IS NULL AND p_user_id IS NULL))
    ) THEN
        RETURN FALSE; -- Already has this achievement
    END IF;

    -- Award the achievement
    INSERT INTO player_achievements (
        player_name,
        tournament_id,
        achievement_id,
        user_id,
        unlocked_at,
        created_at,
        earned_at
    ) VALUES (
        UPPER(p_player_name),
        p_tournament_id,
        p_achievement_id,
        p_user_id,
        NOW(),
        NOW(),
        NOW()
    );

    RETURN TRUE;
END;
$$;

-- Function to check if a score would trigger any achievements (without awarding them)
CREATE OR REPLACE FUNCTION check_score_achievements(
    p_player_name TEXT,
    p_tournament_id UUID,
    p_game_id UUID,
    p_score INTEGER
)
RETURNS TABLE (
    achievement_id UUID,
    achievement_name TEXT,
    achievement_description TEXT,
    would_unlock BOOLEAN
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
        CASE
            WHEN a.type = 'score_milestone' THEN
                p_score >= COALESCE((a.criteria->>'min_score')::INTEGER, 1000)
            WHEN a.type = 'first_score' THEN
                NOT EXISTS(SELECT 1 FROM scores WHERE player_name = UPPER(p_player_name) AND tournament_id = p_tournament_id)
            WHEN a.type = 'first_place' THEN
                NOT EXISTS(SELECT 1 FROM scores WHERE game_id = p_game_id AND tournament_id = p_tournament_id AND score > p_score)
            ELSE FALSE
        END as would_unlock
    FROM achievements a
    WHERE a.tournament_id = p_tournament_id
      AND a.is_active = true
      AND a.id NOT IN (
          SELECT achievement_id FROM player_achievements
          WHERE player_name = UPPER(p_player_name)
            AND tournament_id = p_tournament_id
      );
END;
$$;