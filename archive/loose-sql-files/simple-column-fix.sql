-- First, let's see what columns actually exist in your player_stats table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'player_stats' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Simple fix - create function that only uses columns that definitely exist
CREATE OR REPLACE FUNCTION process_score_submission()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    player_rank INTEGER;
    is_first_place BOOLEAN := FALSE;
BEGIN
    -- Calculate player rank
    SELECT COUNT(*) + 1 INTO player_rank
    FROM scores s
    WHERE s.game_id = NEW.game_id 
    AND s.score > NEW.score;
    
    is_first_place := (player_rank = 1);

    -- Use only the columns that exist in most schemas
    INSERT INTO player_stats (
        player_name, 
        total_scores, 
        total_games_played, 
        first_place_count,
        highest_score,
        current_streak,
        longest_streak,
        last_score_date,
        updated_at
    )
    VALUES (
        NEW.player_name, 
        1, 
        1, 
        CASE WHEN is_first_place THEN 1 ELSE 0 END,
        NEW.score,
        1,
        1,
        NOW(),
        NOW()
    )
    ON CONFLICT (player_name) DO UPDATE SET
        total_scores = player_stats.total_scores + 1,
        total_games_played = player_stats.total_games_played + 1,
        first_place_count = player_stats.first_place_count + CASE WHEN is_first_place THEN 1 ELSE 0 END,
        highest_score = GREATEST(player_stats.highest_score, NEW.score),
        current_streak = CASE 
            WHEN player_stats.last_score_date > NOW() - INTERVAL '7 days' 
            THEN player_stats.current_streak + 1 
            ELSE 1 
        END,
        longest_streak = GREATEST(
            player_stats.longest_streak, 
            CASE 
                WHEN player_stats.last_score_date > NOW() - INTERVAL '7 days' 
                THEN player_stats.current_streak + 1 
                ELSE 1 
            END
        ),
        last_score_date = NOW(),
        updated_at = NOW();

    -- Award achievements
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
        WHERE a.name = 'First Score';
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
        WHERE a.name = 'Century Club';
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
        WHERE a.name = 'High Scorer';
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
        WHERE a.name = 'Score Hunter';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
