-- Add default achievements to tournaments automatically

-- Function to create default achievements for a tournament
CREATE OR REPLACE FUNCTION create_default_achievements_for_tournament(p_tournament_id UUID)
RETURNS void AS $$
BEGIN
  -- Insert 10 default achievements for the tournament
  INSERT INTO achievements (tournament_id, name, description, type, badge_icon, badge_color, criteria, points, is_active)
  VALUES 
    (p_tournament_id, 'First Steps', 'Submit your first score', 'first_score', '👶', '#4CAF50', '{"min_scores": 1}', 5, true),
    (p_tournament_id, 'Getting Started', 'Achieve a score of 1,000 or more', 'score_milestone', '🎯', '#8BC34A', '{"min_score": 1000}', 10, true),
    (p_tournament_id, 'High Roller', 'Achieve a score of 10,000 or more', 'high_scorer', '🎲', '#FF9800', '{"min_score": 10000}', 25, true),
    (p_tournament_id, 'Game Explorer', 'Play 5 different games', 'game_master', '🗺️', '#2196F3', '{"game_count": 5}', 15, true),
    (p_tournament_id, 'Perfectionist', 'Achieve a score of 50,000 or more', 'perfectionist', '💎', '#9C27B0', '{"min_score": 50000}', 50, true),
    (p_tournament_id, 'Dedicated Player', 'Submit 25 scores', 'consistent_player', '🔥', '#F44336', '{"min_scores": 25}', 30, true),
    (p_tournament_id, 'Champion', 'Reach the top of any leaderboard', 'first_place', '👑', '#FFD700', '{"first_place": true}', 100, true),
    (p_tournament_id, 'Arcade Master', 'Play 10 different games', 'game_master', '🕹️', '#607D8B', '{"game_count": 10}', 40, true),
    (p_tournament_id, 'Score Hunter', 'Submit 100 scores', 'consistent_player', '🏹', '#795548', '{"min_scores": 100}', 75, true),
    (p_tournament_id, 'Legendary', 'Achieve a score of 100,000 or more', 'score_milestone', '⚡', '#E91E63', '{"min_score": 100000}', 150, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to automatically add default achievements when a tournament is created
CREATE OR REPLACE FUNCTION trigger_create_default_achievements()
RETURNS trigger AS $$
BEGIN
  -- Create default achievements for the new tournament
  PERFORM create_default_achievements_for_tournament(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on tournaments table
DROP TRIGGER IF EXISTS create_default_achievements_trigger ON tournaments;
CREATE TRIGGER create_default_achievements_trigger
  AFTER INSERT ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_achievements();

-- Add default achievements to existing tournaments that don't have any
DO $$
DECLARE
  tournament_record RECORD;
BEGIN
  FOR tournament_record IN 
    SELECT t.id 
    FROM tournaments t 
    LEFT JOIN achievements a ON t.id = a.tournament_id 
    WHERE a.id IS NULL
  LOOP
    PERFORM create_default_achievements_for_tournament(tournament_record.id);
  END LOOP;
END $$;
