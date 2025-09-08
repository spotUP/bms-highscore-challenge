-- Create competition_history table to store completed competitions
CREATE TABLE competition_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_name TEXT NOT NULL, -- e.g., "2025-01", "2025-02"
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  total_players INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  total_scores INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create competition_games table to store games from each competition
CREATE TABLE competition_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES competition_history(id) ON DELETE CASCADE,
  game_name TEXT NOT NULL,
  game_logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create competition_scores table to store all scores from each competition
CREATE TABLE competition_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES competition_history(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  game_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  rank_in_game INTEGER, -- Position in that specific game
  ranking_points INTEGER, -- Points earned for this score
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create competition_players table to store player statistics for each competition
CREATE TABLE competition_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES competition_history(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  total_score BIGINT NOT NULL DEFAULT 0,
  total_ranking_points INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  best_rank INTEGER, -- Best position achieved in any game
  final_rank INTEGER, -- Final overall ranking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_competition_history_name ON competition_history(competition_name);
CREATE INDEX idx_competition_history_dates ON competition_history(start_date, end_date);
CREATE INDEX idx_competition_games_competition_id ON competition_games(competition_id);
CREATE INDEX idx_competition_scores_competition_id ON competition_scores(competition_id);
CREATE INDEX idx_competition_scores_player ON competition_scores(competition_id, player_name);
CREATE INDEX idx_competition_players_competition_id ON competition_players(competition_id);
CREATE INDEX idx_competition_players_player ON competition_players(competition_id, player_name);

-- Add RLS policies
ALTER TABLE competition_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_players ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read competition history (for statistics page)
CREATE POLICY "Anyone can view competition history" ON competition_history
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view competition games" ON competition_games
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view competition scores" ON competition_scores
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view competition players" ON competition_players
  FOR SELECT USING (true);

-- Only admins can insert/update/delete competition data
CREATE POLICY "Only admins can manage competition history" ON competition_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage competition games" ON competition_games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage competition scores" ON competition_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage competition players" ON competition_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create function to archive current competition
CREATE OR REPLACE FUNCTION archive_current_competition()
RETURNS JSON AS $$
DECLARE
  competition_name TEXT;
  competition_id UUID;
  start_date TIMESTAMP WITH TIME ZONE;
  end_date TIMESTAMP WITH TIME ZONE;
  total_players INTEGER;
  total_games INTEGER;
  total_scores INTEGER;
  result JSON;
BEGIN
  -- Generate competition name based on current month/year
  competition_name := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- Set start date to beginning of current month, end date to now
  start_date := DATE_TRUNC('month', NOW());
  end_date := NOW();
  
  -- Create competition history record
  INSERT INTO competition_history (competition_name, start_date, end_date)
  VALUES (competition_name, start_date, end_date)
  RETURNING id INTO competition_id;
  
  -- Archive games
  INSERT INTO competition_games (competition_id, game_name, game_logo_url)
  SELECT competition_id, name, logo_url
  FROM games
  WHERE include_in_challenge = true;
  
  -- Get total games count
  SELECT COUNT(*) INTO total_games FROM games WHERE include_in_challenge = true;
  
  -- Archive scores with ranking information
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
  
  -- Archive player statistics
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
  
  -- Update competition history with counts
  UPDATE competition_history 
  SET 
    total_players = total_players,
    total_games = total_games,
    total_scores = total_scores
  WHERE id = competition_id;
  
  -- Clear current competition data
  DELETE FROM scores WHERE game_id IN (SELECT id FROM games WHERE include_in_challenge = true);
  
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (will be checked by RLS)
GRANT EXECUTE ON FUNCTION archive_current_competition() TO authenticated;
