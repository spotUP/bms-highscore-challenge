-- Quick Fix for Tournament ID Issue in Player Achievements
-- This ensures the trigger properly passes tournament_id

-- Step 1: Drop ALL existing triggers on scores table to avoid conflicts
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores;
DROP TRIGGER IF EXISTS update_player_stats_trigger ON scores;
DROP TRIGGER IF EXISTS simple_award_achievements_trigger ON scores;

-- Step 2: Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS award_achievements() CASCADE;
DROP FUNCTION IF EXISTS update_player_stats() CASCADE;
DROP FUNCTION IF EXISTS simple_award_achievements() CASCADE;

-- Step 3: Create the corrected trigger function with proper tournament_id handling
CREATE OR REPLACE FUNCTION award_achievements()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Debug log to see what we're working with
    RAISE NOTICE 'Processing score for player: %, tournament: %, score: %', NEW.player_name, NEW.tournament_id, NEW.score;

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

    -- Award "First Score" achievement - EXPLICITLY include tournament_id
    IF NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'First Score'
        AND a.tournament_id = NEW.tournament_id
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'First Score' AND a.tournament_id = NEW.tournament_id;
        
        RAISE NOTICE 'Awarded First Score achievement to %', NEW.player_name;
    END IF;

    -- Award "Century Club" achievement if score >= 100
    IF NEW.score >= 100 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'Century Club'
        AND a.tournament_id = NEW.tournament_id
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'Century Club' AND a.tournament_id = NEW.tournament_id;
        
        RAISE NOTICE 'Awarded Century Club achievement to %', NEW.player_name;
    END IF;

    -- Award "High Scorer" achievement if score >= 1000
    IF NEW.score >= 1000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'High Scorer'
        AND a.tournament_id = NEW.tournament_id
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'High Scorer' AND a.tournament_id = NEW.tournament_id;
        
        RAISE NOTICE 'Awarded High Scorer achievement to %', NEW.player_name;
    END IF;

    -- Award "Score Hunter" achievement if score >= 10000
    IF NEW.score >= 10000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'Score Hunter'
        AND a.tournament_id = NEW.tournament_id
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'Score Hunter' AND a.tournament_id = NEW.tournament_id;
        
        RAISE NOTICE 'Awarded Score Hunter achievement to %', NEW.player_name;
    END IF;

    -- Award "Perfect Game" achievement if score >= 50000
    IF NEW.score >= 50000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'Perfect Game'
        AND a.tournament_id = NEW.tournament_id
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'Perfect Game' AND a.tournament_id = NEW.tournament_id;
        
        RAISE NOTICE 'Awarded Perfect Game achievement to %', NEW.player_name;
    END IF;

    -- Award "Score Legend" achievement if score >= 100000
    IF NEW.score >= 100000 AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa 
        JOIN achievements a ON pa.achievement_id = a.id
        WHERE pa.player_name = NEW.player_name 
        AND pa.tournament_id = NEW.tournament_id
        AND a.name = 'Score Legend'
        AND a.tournament_id = NEW.tournament_id
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
        SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
        FROM achievements a
        WHERE a.name = 'Score Legend' AND a.tournament_id = NEW.tournament_id;
        
        RAISE NOTICE 'Awarded Score Legend achievement to %', NEW.player_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create the trigger (clean slate)
CREATE TRIGGER award_achievements_trigger
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION award_achievements();

SELECT 'Tournament ID fix applied! Achievement system ready!' as status;
