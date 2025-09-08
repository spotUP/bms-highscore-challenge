-- Drop and recreate the archive function with better error handling
DROP FUNCTION IF EXISTS archive_current_competition();

CREATE OR REPLACE FUNCTION archive_current_competition()
RETURNS JSON AS $$
DECLARE
  competition_name TEXT;
  competition_id UUID;
  start_date TIMESTAMP WITH TIME ZONE;
  end_date TIMESTAMP WITH TIME ZONE;
  total_players INTEGER := 0;
  total_games INTEGER := 0;
  total_scores INTEGER := 0;
  result JSON;
BEGIN
  -- Generate competition name based on current month/year
  competition_name := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- Set start date to beginning of current month, end date to now
  start_date := DATE_TRUNC('month', NOW());
  end_date := NOW();
  
  -- Check if there are any games to archive
  SELECT COUNT(*) INTO total_games FROM games WHERE include_in_challenge = true;
  
  IF total_games = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No games found to archive'
    );
  END IF;
  
  -- Create competition history record
  INSERT INTO competition_history (competition_name, start_date, end_date, total_games)
  VALUES (competition_name, start_date, end_date, total_games)
  RETURNING id INTO competition_id;
  
  -- Archive games
  INSERT INTO competition_games (competition_id, game_name, game_logo_url)
  SELECT competition_id, name, logo_url
  FROM games
  WHERE include_in_challenge = true;
  
  -- Archive scores with ranking information (only if scores exist)
  WITH ranked_scores AS (
    SELECT 
      s.*,
      g.name as game_name,
      ROW_NUMBER() OVER (PARTITION BY s.game_id ORDER BY s.score DESC) as rank_in_game
    FROM scores s
    JOIN games g ON s.game_id = g.id
    WHERE g.include_in_challenge = true
  )
  INSERT INTO competition_scores (competition_id, player_name, game_name, score, rank_in_game, ranking_points)
  SELECT 
    competition_id,
    player_name,
    game_name,
    score,
    rank_in_game,
    CASE 
      WHEN rank_in_game = 1 THEN 100
      WHEN rank_in_game = 2 THEN 80
      WHEN rank_in_game = 3 THEN 70
      WHEN rank_in_game = 4 THEN 60
      WHEN rank_in_game = 5 THEN 50
      ELSE GREATEST(100 - (rank_in_game - 1) * 10, 10)
    END as ranking_points
  FROM ranked_scores;
  
  -- Get total scores count
  SELECT COUNT(*) INTO total_scores FROM competition_scores WHERE competition_id = competition_id;
  
  -- Archive player statistics (only if scores exist)
  IF total_scores > 0 THEN
    WITH player_stats AS (
      SELECT 
        player_name,
        SUM(score) as total_score,
        SUM(CASE 
          WHEN rank_in_game = 1 THEN 100
          WHEN rank_in_game = 2 THEN 80
          WHEN rank_in_game = 3 THEN 70
          WHEN rank_in_game = 4 THEN 60
          WHEN rank_in_game = 5 THEN 50
          ELSE GREATEST(100 - (rank_in_game - 1) * 10, 10)
        END) as total_ranking_points,
        COUNT(*) as games_played,
        MIN(rank_in_game) as best_rank
      FROM competition_scores
      WHERE competition_id = competition_id
      GROUP BY player_name
    ),
    ranked_players AS (
      SELECT 
        *,
        ROW_NUMBER() OVER (ORDER BY total_ranking_points DESC, total_score DESC) as final_rank
      FROM player_stats
    )
    INSERT INTO competition_players (competition_id, player_name, total_score, total_ranking_points, games_played, best_rank, final_rank)
    SELECT 
      competition_id,
      player_name,
      total_score,
      total_ranking_points,
      games_played,
      best_rank,
      final_rank
    FROM ranked_players;
    
    -- Get total players count
    SELECT COUNT(*) INTO total_players FROM competition_players WHERE competition_id = competition_id;
  END IF;
  
  -- Update competition history with counts
  UPDATE competition_history 
  SET 
    total_players = total_players,
    total_scores = total_scores
  WHERE id = competition_id;
  
  -- Clear current competition data
  DELETE FROM scores WHERE game_id IN (SELECT id FROM games WHERE include_in_challenge = true);
  
  -- Remove games from challenge
  UPDATE games SET include_in_challenge = false WHERE include_in_challenge = true;
  
  -- Return result
  result := json_build_object(
    'success', true,
    'competition_id', competition_id,
    'competition_name', competition_name,
    'total_players', total_players,
    'total_games', total_games,
    'total_scores', total_scores,
    'start_date', start_date,
    'end_date', end_date
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (will be checked by RLS)
GRANT EXECUTE ON FUNCTION archive_current_competition() TO authenticated;
