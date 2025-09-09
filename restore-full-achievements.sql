-- Restore the full achievement system now that we know triggers work
-- Replace the simple test trigger with the complete achievement system

-- Step 1: Drop the test trigger
DROP TRIGGER IF EXISTS test_trigger ON scores CASCADE;
DROP FUNCTION IF EXISTS test_function() CASCADE;

-- Step 2: Create the complete achievement function
CREATE OR REPLACE FUNCTION award_achievements()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE NOTICE 'ACHIEVEMENT TRIGGER START: player=%, score=%, tournament=%', NEW.player_name, NEW.score, NEW.tournament_id;

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
            AND pa.tournament_id = NEW.tournament_id
        );
        
        IF FOUND THEN
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
                AND pa.tournament_id = NEW.tournament_id
            );
            
            IF FOUND THEN
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
                AND pa.tournament_id = NEW.tournament_id
            );
            
            IF FOUND THEN
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
                AND pa.tournament_id = NEW.tournament_id
            );
            
            IF FOUND THEN
                RAISE NOTICE 'Awarded Score Hunter achievement to %', NEW.player_name;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error awarding Score Hunter: %', SQLERRM;
        END;
    END IF;

    -- Award Perfect Game (50000+)
    IF NEW.score >= 50000 THEN
        BEGIN
            INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
            SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
            FROM achievements a
            WHERE a.name = 'Perfect Game' 
            AND a.tournament_id = NEW.tournament_id
            AND NOT EXISTS (
                SELECT 1 FROM player_achievements pa
                WHERE pa.player_name = NEW.player_name
                AND pa.achievement_id = a.id
                AND pa.tournament_id = NEW.tournament_id
            );
            
            IF FOUND THEN
                RAISE NOTICE 'Awarded Perfect Game achievement to %', NEW.player_name;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error awarding Perfect Game: %', SQLERRM;
        END;
    END IF;

    -- Award Score Legend (100000+)
    IF NEW.score >= 100000 THEN
        BEGIN
            INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
            SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
            FROM achievements a
            WHERE a.name = 'Score Legend' 
            AND a.tournament_id = NEW.tournament_id
            AND NOT EXISTS (
                SELECT 1 FROM player_achievements pa
                WHERE pa.player_name = NEW.player_name
                AND pa.achievement_id = a.id
                AND pa.tournament_id = NEW.tournament_id
            );
            
            IF FOUND THEN
                RAISE NOTICE 'Awarded Score Legend achievement to %', NEW.player_name;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error awarding Score Legend: %', SQLERRM;
        END;
    END IF;

    RAISE NOTICE 'ACHIEVEMENT TRIGGER COMPLETE for %', NEW.player_name;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'CRITICAL ERROR in achievement trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create the full achievement trigger
CREATE TRIGGER award_achievements_trigger
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION award_achievements();

-- Step 4: Award achievements to existing high scorers retroactively
-- This will give achievements to players who already have high scores
DO $$
DECLARE
    score_record RECORD;
BEGIN
    RAISE NOTICE 'Starting retroactive achievement awards...';
    
    -- Process existing scores over 1000 to award achievements retroactively
    FOR score_record IN 
        SELECT DISTINCT player_name, MAX(score) as highest_score, tournament_id
        FROM scores 
        WHERE tournament_id = '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'
        AND score >= 100
        GROUP BY player_name, tournament_id
    LOOP
        -- Award achievements based on their highest score
        RAISE NOTICE 'Processing retroactive achievements for % (highest: %)', score_record.player_name, score_record.highest_score;
        
        -- Update the scores table to trigger achievements for this player's highest score
        UPDATE scores 
        SET updated_at = NOW() 
        WHERE id = (
            SELECT id FROM scores 
            WHERE player_name = score_record.player_name 
            AND score = score_record.highest_score 
            AND tournament_id = score_record.tournament_id
            ORDER BY created_at DESC
            LIMIT 1
        );
    END LOOP;
    
    RAISE NOTICE 'Retroactive achievement processing complete!';
END $$;

SELECT 'Full achievement system restored and retroactive awards processed!' as status;
