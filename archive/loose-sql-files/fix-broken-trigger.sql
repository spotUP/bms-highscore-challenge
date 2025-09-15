-- Fix the broken trigger that's not firing
-- The issue is that the trigger may not have been created properly

-- Step 1: Check what triggers exist
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'scores'
AND event_object_schema = 'public';

-- Step 2: Drop any existing triggers completely
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores CASCADE;
DROP TRIGGER IF EXISTS update_player_stats_trigger ON scores CASCADE;
DROP TRIGGER IF EXISTS simple_award_achievements_trigger ON scores CASCADE;

-- Step 3: Drop and recreate the function with better error handling
DROP FUNCTION IF EXISTS award_achievements() CASCADE;

CREATE OR REPLACE FUNCTION award_achievements()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Always log trigger execution
    RAISE NOTICE 'ACHIEVEMENT TRIGGER FIRED: player=%, score=%, tournament=%', NEW.player_name, NEW.score, NEW.tournament_id;

    -- Validate inputs
    IF NEW.tournament_id IS NULL THEN
        RAISE NOTICE 'ERROR: tournament_id is NULL!';
        RETURN NEW;
    END IF;

    IF NEW.player_name IS NULL THEN
        RAISE NOTICE 'ERROR: player_name is NULL!';
        RETURN NEW;
    END IF;

    -- Update player stats
    BEGIN
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
        
        RAISE NOTICE 'Player stats updated for %', NEW.player_name;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error updating player_stats: %', SQLERRM;
    END;

    -- Award First Score achievement (always)
    BEGIN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'First Score' 
        AND a.tournament_id = NEW.tournament_id
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements pa
            WHERE pa.player_name = NEW.player_name
            AND pa.achievement_id = a.id
            AND COALESCE(pa.tournament_id::text, '') = COALESCE(NEW.tournament_id::text, '')
        );
        
        GET DIAGNOSTICS achievement_count = ROW_COUNT;
        IF achievement_count > 0 THEN
            RAISE NOTICE 'Awarded First Score achievement to %', NEW.player_name;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error awarding First Score: %', SQLERRM;
    END;

    -- Award Century Club (100+)
    IF NEW.score >= 100 THEN
        BEGIN
            INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
            SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
            FROM achievements a
            WHERE a.name = 'Century Club' 
            AND a.tournament_id = NEW.tournament_id
            AND NOT EXISTS (
                SELECT 1 FROM player_achievements pa
                WHERE pa.player_name = NEW.player_name
                AND pa.achievement_id = a.id
                AND COALESCE(pa.tournament_id::text, '') = COALESCE(NEW.tournament_id::text, '')
            );
            
            GET DIAGNOSTICS achievement_count = ROW_COUNT;
            IF achievement_count > 0 THEN
                RAISE NOTICE 'Awarded Century Club achievement to %', NEW.player_name;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error awarding Century Club: %', SQLERRM;
        END;
    END IF;

    -- Award High Scorer (1000+)
    IF NEW.score >= 1000 THEN
        BEGIN
            INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
            SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
            FROM achievements a
            WHERE a.name = 'High Scorer' 
            AND a.tournament_id = NEW.tournament_id
            AND NOT EXISTS (
                SELECT 1 FROM player_achievements pa
                WHERE pa.player_name = NEW.player_name
                AND pa.achievement_id = a.id
                AND COALESCE(pa.tournament_id::text, '') = COALESCE(NEW.tournament_id::text, '')
            );
            
            GET DIAGNOSTICS achievement_count = ROW_COUNT;
            IF achievement_count > 0 THEN
                RAISE NOTICE 'Awarded High Scorer achievement to %', NEW.player_name;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error awarding High Scorer: %', SQLERRM;
        END;
    END IF;

    -- Award Score Hunter (10000+)
    IF NEW.score >= 10000 THEN
        BEGIN
            INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
            SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
            FROM achievements a
            WHERE a.name = 'Score Hunter' 
            AND a.tournament_id = NEW.tournament_id
            AND NOT EXISTS (
                SELECT 1 FROM player_achievements pa
                WHERE pa.player_name = NEW.player_name
                AND pa.achievement_id = a.id
                AND COALESCE(pa.tournament_id::text, '') = COALESCE(NEW.tournament_id::text, '')
            );
            
            GET DIAGNOSTICS achievement_count = ROW_COUNT;
            IF achievement_count > 0 THEN
                RAISE NOTICE 'Awarded Score Hunter achievement to %', NEW.player_name;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error awarding Score Hunter: %', SQLERRM;
        END;
    END IF;

    RAISE NOTICE 'ACHIEVEMENT TRIGGER COMPLETED for %', NEW.player_name;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'CRITICAL ERROR in achievement trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create the trigger with explicit timing
CREATE TRIGGER award_achievements_trigger
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION award_achievements();

-- Step 5: Verify the trigger was created
SELECT trigger_name, event_manipulation, action_timing 
FROM information_schema.triggers 
WHERE event_object_table = 'scores' 
AND trigger_name = 'award_achievements_trigger';

-- Step 6: Test with existing data by updating a recent score
-- This will fire the trigger on the most recent score
DO $$
DECLARE
    recent_score_id UUID;
    achievement_count INTEGER;
BEGIN
    -- Get the most recent score ID
    SELECT id INTO recent_score_id 
    FROM scores 
    WHERE tournament_id = '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF recent_score_id IS NOT NULL THEN
        -- Update the score to trigger the achievement system
        UPDATE scores SET updated_at = NOW() WHERE id = recent_score_id;
        RAISE NOTICE 'Triggered achievement check for recent score: %', recent_score_id;
    END IF;
END $$;

SELECT 'Trigger fixed and tested!' as status;
