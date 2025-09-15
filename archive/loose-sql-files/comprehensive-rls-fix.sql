-- Comprehensive fix for RLS issues with player_stats
-- This script safely handles all existing triggers and functions

-- Step 1: Drop all existing triggers first (to resolve dependencies)
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores;
DROP TRIGGER IF EXISTS trigger_update_player_stats ON scores;
DROP TRIGGER IF EXISTS update_player_stats ON scores;
DROP TRIGGER IF EXISTS trigger_check_achievements_on_score ON scores;
DROP TRIGGER IF EXISTS check_achievements_on_score ON scores;
DROP TRIGGER IF EXISTS trigger_check_achievements_on_game_play ON scores;
DROP TRIGGER IF EXISTS check_achievements_on_game_play ON scores;

-- Step 2: Drop all existing functions (now safe since triggers are dropped)
DROP FUNCTION IF EXISTS award_achievements() CASCADE;
DROP FUNCTION IF EXISTS update_player_stats() CASCADE;
DROP FUNCTION IF EXISTS check_achievements_on_score() CASCADE;
DROP FUNCTION IF EXISTS check_achievements_on_game_play() CASCADE;
DROP FUNCTION IF EXISTS check_and_award_achievements(TEXT, UUID, INTEGER, BOOLEAN) CASCADE;

-- Step 3: Drop and recreate RLS policies for player_stats
DROP POLICY IF EXISTS "System can manage player stats" ON player_stats;
DROP POLICY IF EXISTS "Allow authenticated insert/update on player_stats" ON player_stats;
DROP POLICY IF EXISTS "Anyone can view player stats" ON player_stats;
DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON player_stats;
DROP POLICY IF EXISTS "Allow public read on player_stats" ON player_stats;
DROP POLICY IF EXISTS "Allow authenticated insert on player_stats" ON player_stats;
DROP POLICY IF EXISTS "Allow all operations on player_stats" ON player_stats;

-- Create simple, permissive policies
CREATE POLICY "player_stats_select" ON player_stats FOR SELECT USING (true);
CREATE POLICY "player_stats_insert" ON player_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "player_stats_update" ON player_stats FOR UPDATE USING (true) WITH CHECK (true);

-- Step 4: Create a single, comprehensive trigger function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION process_score_submission()
RETURNS TRIGGER
SECURITY DEFINER -- Critical: allows bypassing RLS
SET search_path = public -- Security best practice
AS $$
DECLARE
    player_rank INTEGER;
    is_first_place BOOLEAN := FALSE;
BEGIN
    -- Calculate player rank for this score
    SELECT COUNT(*) + 1 INTO player_rank
    FROM scores s
    WHERE s.game_id = NEW.game_id 
    AND s.score > NEW.score;
    
    is_first_place := (player_rank = 1);

    -- Update or insert player stats
    INSERT INTO player_stats (
        player_name, 
        total_scores, 
        total_games_played, 
        first_place_count,
        total_score,
        best_score,
        highest_score, -- Handle both column names for compatibility
        current_streak,
        longest_streak,
        last_score_date,
        created_at,
        updated_at
    )
    VALUES (
        NEW.player_name, 
        1, 
        1, 
        CASE WHEN is_first_place THEN 1 ELSE 0 END,
        NEW.score,
        NEW.score,
        NEW.score,
        1,
        1,
        NOW(),
        NOW(),
        NOW()
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
        AND a.name = 'Champion'
    ) THEN
        INSERT INTO player_achievements (player_name, achievement_id, unlocked_at)
        SELECT NEW.player_name, a.id, NOW()
        FROM achievements a
        WHERE a.name = 'Champion'
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements pa2 
            WHERE pa2.player_name = NEW.player_name 
            AND pa2.achievement_id = a.id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create a single trigger that handles everything
CREATE TRIGGER process_score_submission_trigger
    AFTER INSERT OR UPDATE ON scores
    FOR EACH ROW
    EXECUTE FUNCTION process_score_submission();

-- Step 6: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON player_stats TO authenticated;
GRANT SELECT, INSERT ON player_achievements TO authenticated;
GRANT SELECT ON achievements TO authenticated;

-- Step 7: Verify the setup
-- Check functions
SELECT 
    'Function: ' || proname as object_info,
    CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security_mode
FROM pg_proc 
WHERE proname = 'process_score_submission';

-- Check policies  
SELECT 
    'Policy: ' || policyname as object_info,
    cmd as policy_type
FROM pg_policies 
WHERE tablename = 'player_stats';

-- Check triggers
SELECT 
    'Trigger: ' || trigger_name as object_info,
    action_timing || ' ' || event_manipulation as trigger_info
FROM information_schema.triggers 
WHERE event_object_table = 'scores'
AND trigger_schema = 'public';
