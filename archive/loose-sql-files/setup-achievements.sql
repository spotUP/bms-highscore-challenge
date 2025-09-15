ALTER TABLE achievements DISABLE ROW LEVEL SECURITY;

INSERT INTO achievements (name, description, tournament_id) VALUES
('First Score', 'Submit your first score', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'),
('High Scorer', 'Score 5,000 points or more', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'),
('Score Hunter', 'Score 10,000 points or more', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'),
('Perfect Game', 'Score 50,000 points or more', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'),
('Score Legend', 'Score 100,000 points or more', '72e5cd46-2fab-4c20-bcd0-f4d84346ec26');

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
    ON CONFLICT (player_name) DO UPDATE SET
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
        updated_at = NOW(),
        tournament_id = NEW.tournament_id;

    INSERT INTO player_achievements (player_name, achievement_id, tournament_id)
    SELECT NEW.player_name, a.id, NEW.tournament_id
    FROM achievements a
    WHERE a.tournament_id = NEW.tournament_id
      AND NOT EXISTS (
        SELECT 1 FROM player_achievements pa
        WHERE pa.player_name = NEW.player_name
          AND pa.tournament_id = NEW.tournament_id
          AND pa.achievement_id = a.id
      )
      AND (
        (a.name = 'First Score')
        OR
        (a.name = 'High Scorer' AND NEW.score >= 5000)
        OR
        (a.name = 'Score Hunter' AND NEW.score >= 10000)
        OR
        (a.name = 'Perfect Game' AND NEW.score >= 50000)
        OR
        (a.name = 'Score Legend' AND NEW.score >= 100000)
      );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SELECT 'Achievements and trigger updated' as status;
