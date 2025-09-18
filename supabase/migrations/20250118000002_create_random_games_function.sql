-- Create function to get truly random games efficiently
CREATE OR REPLACE FUNCTION get_random_games(game_count INTEGER DEFAULT 10)
RETURNS TABLE(id TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT games_database.id
  FROM games_database
  ORDER BY RANDOM()
  LIMIT game_count;
END;
$$ LANGUAGE plpgsql;