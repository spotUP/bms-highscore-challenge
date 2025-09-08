-- Achievement System Migration
-- Run this in your Supabase SQL Editor to set up the achievement system

-- Create achievement types enum
CREATE TYPE achievement_type AS ENUM (
  'first_score',
  'first_place',
  'score_milestone',
  'game_master',
  'streak_master',
  'competition_winner',
  'high_scorer',
  'consistent_player',
  'speed_demon',
  'perfectionist'
);

-- Create achievements table
CREATE TABLE achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type achievement_type NOT NULL,
  badge_icon TEXT NOT NULL, -- Icon name or URL
  badge_color TEXT NOT NULL, -- Hex color for badge
  criteria JSONB NOT NULL, -- Criteria for unlocking (e.g., {"min_score": 10000, "game_count": 5})
  points INTEGER NOT NULL DEFAULT 10, -- Points awarded for unlocking
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player_achievements table
CREATE TABLE player_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  game_id UUID REFERENCES games(id) ON DELETE SET NULL, -- Game that triggered the achievement
  score INTEGER, -- Score that triggered the achievement
  metadata JSONB, -- Additional data about the achievement unlock
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player_stats table for tracking player statistics
CREATE TABLE player_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL UNIQUE,
  total_scores INTEGER NOT NULL DEFAULT 0,
  total_games_played INTEGER NOT NULL DEFAULT 0,
  first_place_count INTEGER NOT NULL DEFAULT 0,
  total_score BIGINT NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_score_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for achievements
CREATE POLICY "Achievements are viewable by everyone" ON achievements
  FOR SELECT USING (true);

-- RLS Policies for player_achievements
CREATE POLICY "Player achievements are viewable by everyone" ON player_achievements
  FOR SELECT USING (true);

-- System can insert player achievements
CREATE POLICY "System can manage player achievements" ON player_achievements
  FOR INSERT WITH CHECK (true);

-- RLS Policies for player_stats
CREATE POLICY "Player stats are viewable by everyone" ON player_stats
  FOR SELECT USING (true);

-- System can update player stats
CREATE POLICY "System can manage player stats" ON player_stats
  FOR ALL WITH CHECK (true);

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_and_award_achievements(
  p_player_name TEXT,
  p_game_id UUID,
  p_score INTEGER,
  p_is_first_place BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  player_stat_record RECORD;
  new_achievements JSON := '[]'::json;
  achievement_count INTEGER := 0;
BEGIN
  -- Get or create player stats
  INSERT INTO player_stats (player_name, total_scores, total_games_played, first_place_count, total_score, best_score, last_score_date)
  VALUES (p_player_name, 1, 1, CASE WHEN p_is_first_place THEN 1 ELSE 0 END, p_score, p_score, NOW())
  ON CONFLICT (player_name) DO UPDATE SET
    total_scores = player_stats.total_scores + 1,
    total_games_played = player_stats.total_games_played + 1,
    first_place_count = player_stats.first_place_count + CASE WHEN p_is_first_place THEN 1 ELSE 0 END,
    total_score = player_stats.total_score + p_score,
    best_score = GREATEST(player_stats.best_score, p_score),
    last_score_date = NOW(),
    updated_at = NOW()
  RETURNING * INTO player_stat_record;

  -- Check for achievements
  FOR achievement_record IN 
    SELECT * FROM achievements 
    WHERE is_active = true 
    AND id NOT IN (
      SELECT achievement_id FROM player_achievements 
      WHERE player_name = p_player_name
    )
  LOOP
    DECLARE
      should_award BOOLEAN := false;
    BEGIN
      -- Check achievement criteria based on type
      CASE achievement_record.type
        WHEN 'first_score' THEN
          should_award := player_stat_record.total_scores = 1;
          
        WHEN 'first_place' THEN
          should_award := p_is_first_place;
          
        WHEN 'score_milestone' THEN
          should_award := p_score >= (achievement_record.criteria->>'min_score')::INTEGER;
          
        WHEN 'game_master' THEN
          should_award := player_stat_record.total_games_played >= (achievement_record.criteria->>'game_count')::INTEGER;
          
        WHEN 'high_scorer' THEN
          should_award := p_score >= (achievement_record.criteria->>'min_score')::INTEGER;
          
        WHEN 'consistent_player' THEN
          should_award := player_stat_record.total_scores >= (achievement_record.criteria->>'min_scores')::INTEGER;
          
        ELSE
          should_award := false;
      END CASE;

      -- Award achievement if criteria met
      IF should_award THEN
        INSERT INTO player_achievements (player_name, achievement_id, game_id, score, metadata)
        VALUES (
          p_player_name, 
          achievement_record.id, 
          p_game_id, 
          p_score,
          jsonb_build_object(
            'unlocked_via', achievement_record.type,
            'criteria_met', achievement_record.criteria
          )
        );
        
        new_achievements := new_achievements || jsonb_build_object(
          'id', achievement_record.id,
          'name', achievement_record.name,
          'description', achievement_record.description,
          'badge_icon', achievement_record.badge_icon,
          'badge_color', achievement_record.badge_color,
          'points', achievement_record.points
        );
        
        achievement_count := achievement_count + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'achievement_count', achievement_count,
    'new_achievements', new_achievements
  );
END;
$$ LANGUAGE plpgsql;

-- Insert sample achievements
INSERT INTO achievements (name, description, type, badge_icon, badge_color, criteria, points) VALUES
-- First Score Achievement
('First Steps', 'Submit your very first score!', 'first_score', '🎯', '#4CAF50', '{}', 10),

-- First Place Achievements
('Champion', 'Achieve first place in any game!', 'first_place', '👑', '#FFD700', '{}', 25),
('Double Champion', 'Achieve first place in 2 different games', 'first_place', '👑👑', '#FFD700', '{"game_count": 2}', 50),
('Triple Champion', 'Achieve first place in 3 different games', 'first_place', '👑👑👑', '#FFD700', '{"game_count": 3}', 100),

-- Score Milestone Achievements
('Score Hunter', 'Score 10,000 points in a single game', 'score_milestone', '🎯', '#FF5722', '{"min_score": 10000}', 20),
('Score Master', 'Score 50,000 points in a single game', 'score_milestone', '🎯', '#E91E63', '{"min_score": 50000}', 50),
('Score Legend', 'Score 100,000 points in a single game', 'score_milestone', '🎯', '#9C27B0', '{"min_score": 100000}', 100),

-- Game Master Achievements
('Game Explorer', 'Play 5 different games', 'game_master', '🎮', '#2196F3', '{"game_count": 5}', 30),
('Game Master', 'Play 10 different games', 'game_master', '🎮', '#3F51B5', '{"game_count": 10}', 75),
('Game Legend', 'Play 20 different games', 'game_master', '🎮', '#673AB7', '{"game_count": 20}', 150),

-- High Scorer Achievements
('High Roller', 'Score 25,000+ points in any game', 'high_scorer', '💎', '#00BCD4', '{"min_score": 25000}', 40),
('Elite Scorer', 'Score 75,000+ points in any game', 'high_scorer', '💎', '#009688', '{"min_score": 75000}', 80),

-- Consistent Player Achievements
('Regular Player', 'Submit 10 scores', 'consistent_player', '📈', '#4CAF50', '{"min_scores": 10}', 25),
('Dedicated Player', 'Submit 25 scores', 'consistent_player', '📈', '#8BC34A', '{"min_scores": 25}', 60),
('Loyal Player', 'Submit 50 scores', 'consistent_player', '📈', '#CDDC39', '{"min_scores": 50}', 125);

-- Create trigger to automatically check achievements on score insert/update
CREATE OR REPLACE FUNCTION trigger_achievement_check()
RETURNS TRIGGER AS $$
DECLARE
  is_first_place BOOLEAN := false;
  result JSON;
BEGIN
  -- Check if this is a first place score
  SELECT NOT EXISTS(
    SELECT 1 FROM scores 
    WHERE game_id = NEW.game_id 
    AND score > NEW.score
  ) INTO is_first_place;

  -- Check and award achievements
  SELECT check_and_award_achievements(
    NEW.player_name,
    NEW.game_id,
    NEW.score,
    is_first_place
  ) INTO result;

  -- Log achievement unlocks (optional)
  IF (result->>'achievement_count')::INTEGER > 0 THEN
    RAISE NOTICE 'Player % unlocked % achievements', NEW.player_name, result->>'achievement_count';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS achievement_check_trigger ON scores;
CREATE TRIGGER achievement_check_trigger
  AFTER INSERT OR UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_check();
