-- Emergency RLS Fix - Direct approach
-- Completely disable RLS on scores and player_stats tables temporarily

ALTER TABLE scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats DISABLE ROW LEVEL SECURITY;

-- Test basic functionality
SELECT 'RLS disabled on both tables' as status;

-- Now try the trigger function with proper SECURITY DEFINER
CREATE OR REPLACE FUNCTION award_achievements()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update or create player stats (remove tournament_id reference)
    INSERT INTO player_stats (
        player_name,
        total_scores,
        total_games_played,
        total_score,
        best_score,
        last_score_date
    )
    VALUES (
        NEW.player_name,
        1,
        1,
        NEW.score,
        NEW.score,
        NOW()
    )
    ON CONFLICT (player_name) DO UPDATE SET
        total_scores = player_stats.total_scores + 1,
        total_games_played = player_stats.total_games_played + 1,
        total_score = player_stats.total_score + NEW.score,
        best_score = GREATEST(player_stats.best_score, NEW.score),
        last_score_date = NOW(),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS award_achievements_trigger ON scores;
CREATE TRIGGER award_achievements_trigger
    AFTER INSERT ON scores
    FOR EACH ROW
    EXECUTE FUNCTION award_achievements();

SELECT 'Emergency RLS fix applied - RLS disabled, trigger recreated' as status;
