-- Ultra simple trigger test to isolate the issue
-- Let's create the most basic possible trigger to see if it fires at all

-- Step 1: Drop everything and start fresh
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores CASCADE;
DROP TRIGGER IF EXISTS test_trigger ON scores CASCADE;
DROP FUNCTION IF EXISTS award_achievements() CASCADE;
DROP FUNCTION IF EXISTS test_function() CASCADE;

-- Step 2: Create a super simple test function that just logs
CREATE OR REPLACE FUNCTION test_function()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'TEST TRIGGER FIRED! Player: %, Score: %', NEW.player_name, NEW.score;
    
    -- Try to insert a simple achievement record
    INSERT INTO player_achievements (player_name, achievement_id, tournament_id, unlocked_at)
    SELECT NEW.player_name, a.id, NEW.tournament_id, NOW()
    FROM achievements a
    WHERE a.name = 'First Score' 
    AND a.tournament_id = NEW.tournament_id
    LIMIT 1;
    
    RAISE NOTICE 'Achievement insert attempted for %', NEW.player_name;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in test trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a simple trigger
CREATE TRIGGER test_trigger
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION test_function();

-- Step 4: Verify trigger was created
SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'scores' 
AND event_object_schema = 'public';

-- Step 5: Check if RLS is blocking us
SELECT 
    schemaname,
    tablename, 
    rowsecurity,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'player_achievements') as policy_count
FROM pg_tables 
WHERE tablename IN ('scores', 'player_achievements', 'achievements');

-- Step 6: Test insert manually to see if trigger fires
INSERT INTO scores (player_name, game_id, score, tournament_id)
SELECT 'TEST_MANUAL_' || EXTRACT(EPOCH FROM NOW()), 
       g.id, 
       999, 
       '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'
FROM games g 
LIMIT 1;

SELECT 'Ultra simple trigger test complete - check logs!' as status;
