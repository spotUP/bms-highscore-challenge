SELECT
    event_object_table,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'scores'
ORDER BY trigger_name;

SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'update_player_stats';

CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    player_rank INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO player_rank
    FROM scores
    WHERE game_id = NEW.game_id
      AND tournament_id = NEW.tournament_id
      AND score > NEW.score;

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
        CASE WHEN player_rank = 1 THEN 1 ELSE 0 END,
        1,
        1,
        1,
        NOW()
    )
    ON CONFLICT (player_name, tournament_id) DO UPDATE SET
        total_scores = player_stats.total_scores + 1,
        total_games_played = player_stats.total_games_played + 1,
        highest_score = GREATEST(player_stats.highest_score, NEW.score),
        first_place_count = player_stats.first_place_count + CASE WHEN player_rank = 1 THEN 1 ELSE 0 END,
        total_competitions = player_stats.total_competitions + 1,
        current_streak = CASE
            WHEN player_rank = 1 THEN player_stats.current_streak + 1
            ELSE 1
        END,
        longest_streak = GREATEST(player_stats.longest_streak,
            CASE WHEN player_rank = 1 THEN player_stats.current_streak + 1 ELSE 1 END
        ),
        last_score_date = NOW(),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SELECT 'Trigger fixed - tournament_id included' as status;
