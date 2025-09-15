-- Fix the column mismatch in the player_stats table
-- This will handle both scenarios: with total_score column or without it

-- First, let's check what columns actually exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'player_stats' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Create a flexible function that works with any player_stats schema
CREATE OR REPLACE FUNCTION process_score_submission()
RETURNS TRIGGER
SECURITY DEFINER -- Critical: allows bypassing RLS
SET search_path = public -- Security best practice
AS $$
DECLARE
    player_rank INTEGER;
    is_first_place BOOLEAN := FALSE;
    has_total_score_column BOOLEAN;
    has_highest_score_column BOOLEAN;
BEGIN
    -- Calculate player rank for this score
    SELECT COUNT(*) + 1 INTO player_rank
    FROM scores s
    WHERE s.game_id = NEW.game_id 
    AND s.score > NEW.score;
    
    is_first_place := (player_rank = 1);

    -- Check which columns exist in player_stats
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'player_stats' 
        AND column_name = 'total_score'
        AND table_schema = 'public'
    ) INTO has_total_score_column;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'player_stats' 
        AND column_name = 'highest_score'
        AND table_schema = 'public'
    ) INTO has_highest_score_column;

    -- Update or insert player stats using dynamic approach
    IF has_total_score_column AND has_highest_score_column THEN
        -- Schema with both total_score and highest_score
        INSERT INTO player_stats (
            player_name, 
            total_scores, 
            total_games_played, 
            first_place_count,
            total_score,
            best_score,
            highest_score,
            current_streak,
            longest_streak,
            last_score_date,
            created_at,
            updated_at
        )
        VALUES (
            NEW.player_name, 1, 1, 
            CASE WHEN is_first_place THEN 1 ELSE 0 END,
            NEW.score, NEW.score, NEW.score,
            1, 1, NOW(), NOW(), NOW()
        )
        ON CONFLICT (player_name) DO UPDATE SET
            total_scores = player_stats.total_scores + 1,
            total_games_played = player_stats.total_games_played + 1,
            first_place_count = player_stats.first_place_count + CASE WHEN is_first_place THEN 1 ELSE 0 END,
            total_score = COALESCE(player_stats.total_score, 0) + NEW.score,
            best_score = GREATEST(COALESCE(player_stats.best_score, 0), NEW.score),
            highest_score = GREATEST(COALESCE(player_stats.highest_score, 0), NEW.score),
            current_streak = CASE 
                WHEN player_stats.last_score_date > NOW() - INTERVAL '7 days' 
                THEN COALESCE(player_stats.current_streak, 0) + 1 
                ELSE 1 
            END,
            longest_streak = GREATEST(
                COALESCE(player_stats.longest_streak, 0), 
                CASE 
                    WHEN player_stats.last_score_date > NOW() - INTERVAL '7 days' 
                    THEN COALESCE(player_stats.current_streak, 0) + 1 
                    ELSE 1 
                END
            ),
            last_score_date = NOW(),
            updated_at = NOW();
    ELSIF has_total_score_column THEN
        -- Schema with total_score but no highest_score
        INSERT INTO player_stats (
            player_name, 
            total_scores, 
            total_games_played, 
            first_place_count,
            total_score,
            best_score,
            current_streak,
            longest_streak,
            last_score_date,
            created_at,
            updated_at
        )
        VALUES (
            NEW.player_name, 1, 1, 
            CASE WHEN is_first_place THEN 1 ELSE 0 END,
            NEW.score, NEW.score,
            1, 1, NOW(), NOW(), NOW()
        )
        ON CONFLICT (player_name) DO UPDATE SET
            total_scores = player_stats.total_scores + 1,
            total_games_played = player_stats.total_games_played + 1,
            first_place_count = player_stats.first_place_count + CASE WHEN is_first_place THEN 1 ELSE 0 END,
            total_score = COALESCE(player_stats.total_score, 0) + NEW.score,
            best_score = GREATEST(COALESCE(player_stats.best_score, 0), NEW.score),
            current_streak = CASE 
                WHEN player_stats.last_score_date > NOW() - INTERVAL '7 days' 
                THEN COALESCE(player_stats.current_streak, 0) + 1 
                ELSE 1 
            END,
            longest_streak = GREATEST(
                COALESCE(player_stats.longest_streak, 0), 
                CASE 
                    WHEN player_stats.last_score_date > NOW() - INTERVAL '7 days' 
                    THEN COALESCE(player_stats.current_streak, 0) + 1 
                    ELSE 1 
                END
            ),
            last_score_date = NOW(),
            updated_at = NOW();
    ELSE
        -- Schema with highest_score but no total_score (simple version)
        INSERT INTO player_stats (
            player_name, 
            total_scores, 
            total_games_played, 
            first_place_count,
            highest_score,
            current_streak,
            longest_streak,
            last_score_date,
            created_at,
            updated_at
        )
        VALUES (
            NEW.player_name, 1, 1, 
            CASE WHEN is_first_place THEN 1 ELSE 0 END,
            NEW.score,
            1, 1, NOW(), NOW(), NOW()
        )
        ON CONFLICT (player_name) DO UPDATE SET
            total_scores = player_stats.total_scores + 1,
            total_games_played = player_stats.total_games_played + 1,
            first_place_count = player_stats.first_place_count + CASE WHEN is_first_place THEN 1 ELSE 0 END,
            highest_score = GREATEST(COALESCE(player_stats.highest_score, 0), NEW.score),
            current_streak = CASE 
                WHEN player_stats.last_score_date > NOW() - INTERVAL '7 days' 
                THEN COALESCE(player_stats.current_streak, 0) + 1 
                ELSE 1 
            END,
            longest_streak = GREATEST(
                COALESCE(player_stats.longest_streak, 0), 
                CASE 
                    WHEN player_stats.last_score_date > NOW() - INTERVAL '7 days' 
                    THEN COALESCE(player_stats.current_streak, 0) + 1 
                    ELSE 1 
                END
            ),
            last_score_date = NOW(),
            updated_at = NOW();
    END IF;

    -- Award achievements (same logic for all schemas)
    -- First Score achievement
    IF NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'First Score'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, unlocked_at)
        SELECT NEW.player_name, a.id, NOW()
        FROM achievements a
        WHERE a.name = 'First Score'
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements pa2 
            WHERE pa2.player_name = NEW.player_name 
            AND pa2.achievement_id = a.id
        );
    END IF;

    -- Century Club achievement (score >= 100)
    IF NEW.score >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'Century Club'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, unlocked_at)
        SELECT NEW.player_name, a.id, NOW()
        FROM achievements a
        WHERE a.name = 'Century Club'
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements pa2 
            WHERE pa2.player_name = NEW.player_name 
            AND pa2.achievement_id = a.id
        );
    END IF;

    -- High Scorer achievement (score >= 1000)
    IF NEW.score >= 1000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'High Scorer'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, unlocked_at)
        SELECT NEW.player_name, a.id, NOW()
        FROM achievements a
        WHERE a.name = 'High Scorer'
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements pa2 
            WHERE pa2.player_name = NEW.player_name 
            AND pa2.achievement_id = a.id
        );
    END IF;

    -- Score Hunter achievement (score >= 10000)
    IF NEW.score >= 10000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name = 'Score Hunter'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, unlocked_at)
        SELECT NEW.player_name, a.id, NOW()
        FROM achievements a
        WHERE a.name = 'Score Hunter'
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements pa2 
            WHERE pa2.player_name = NEW.player_name 
            AND pa2.achievement_id = a.id
        );
    END IF;

    -- First Place achievement
    IF is_first_place AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND a.name IN ('Champion', 'First Place')
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, unlocked_at)
        SELECT NEW.player_name, a.id, NOW()
        FROM achievements a
        WHERE a.name IN ('Champion', 'First Place')
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements pa2 
            WHERE pa2.player_name = NEW.player_name 
            AND pa2.achievement_id = a.id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
