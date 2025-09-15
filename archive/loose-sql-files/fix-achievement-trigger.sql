-- Fix the achievement trigger functions
-- Run this in your Supabase SQL Editor to fix the rank field error

-- Drop the existing triggers first
DROP TRIGGER IF EXISTS update_player_stats ON scores;
DROP TRIGGER IF EXISTS check_achievements_on_score ON scores;
DROP TRIGGER IF EXISTS check_achievements_on_game_play ON scores;

-- Drop the existing functions
DROP FUNCTION IF EXISTS update_player_stats();
DROP FUNCTION IF EXISTS check_achievements_on_score();
DROP FUNCTION IF EXISTS check_achievements_on_game_play();

-- Create the corrected update_player_stats function
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
DECLARE
  player_rank INTEGER;
BEGIN
  -- Calculate the rank for this player's score
  SELECT COUNT(*) + 1 INTO player_rank
  FROM scores s
  WHERE s.game_id = NEW.game_id 
  AND s.score > NEW.score;

  -- Insert or update player stats
  INSERT INTO player_stats (player_name, total_scores, total_games_played, highest_score, first_place_count, total_competitions, current_streak, longest_streak, last_score_date)
  VALUES (
    NEW.player_name,
    1,
    1,
    NEW.score,
    CASE WHEN player_rank = 1 THEN 1 ELSE 0 END,
    0,
    1,
    1,
    NOW()
  )
  ON CONFLICT (player_name) DO UPDATE SET
    total_scores = player_stats.total_scores + 1,
    total_games_played = player_stats.total_games_played + 1,
    highest_score = GREATEST(player_stats.highest_score, NEW.score),
    first_place_count = player_stats.first_place_count + CASE WHEN player_rank = 1 THEN 1 ELSE 0 END,
    last_score_date = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the corrected check_achievements_on_score function
CREATE OR REPLACE FUNCTION check_achievements_on_score()
RETURNS TRIGGER AS $$
DECLARE
  achievement_record RECORD;
  player_stat RECORD;
  score_count INTEGER;
  game_count INTEGER;
  first_place_count INTEGER;
  competition_count INTEGER;
  current_streak INTEGER;
  perfect_score_count INTEGER;
  player_rank INTEGER;
BEGIN
  -- Calculate the rank for this player's score
  SELECT COUNT(*) + 1 INTO player_rank
  FROM scores s
  WHERE s.game_id = NEW.game_id 
  AND s.score > NEW.score;

  -- Get player stats
  SELECT * INTO player_stat FROM player_stats WHERE player_name = NEW.player_name;
  
  IF player_stat IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check each achievement
  FOR achievement_record IN 
    SELECT * FROM achievements WHERE is_active = true
  LOOP
    -- Skip if player already has this achievement
    IF EXISTS (SELECT 1 FROM player_achievements WHERE player_name = NEW.player_name AND achievement_id = achievement_record.id) THEN
      CONTINUE;
    END IF;

    -- Check achievement criteria based on type
    CASE achievement_record.type
      WHEN 'first_score' THEN
        IF player_stat.total_scores >= 1 THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;

      WHEN 'first_place' THEN
        IF player_rank = 1 THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;

      WHEN 'score_milestone' THEN
        IF player_stat.highest_score >= (achievement_record.criteria->>'min_score')::INTEGER THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;

      WHEN 'game_master' THEN
        IF player_stat.total_games_played >= (achievement_record.criteria->>'min_games')::INTEGER THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;

      WHEN 'streak_master' THEN
        IF player_stat.current_streak >= (achievement_record.criteria->>'min_streak')::INTEGER THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;

      WHEN 'competition_winner' THEN
        IF player_stat.total_competitions >= (achievement_record.criteria->>'min_competitions_won')::INTEGER THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;

      WHEN 'high_scorer' THEN
        IF player_rank = 1 THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;

      WHEN 'consistent_player' THEN
        IF player_stat.total_competitions >= (achievement_record.criteria->>'min_competitions')::INTEGER THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;

      WHEN 'speed_demon' THEN
        -- Check if score was submitted within 1 hour of competition start
        IF EXISTS (
          SELECT 1 FROM games g 
          WHERE g.id = NEW.game_id 
          AND g.created_at > NOW() - INTERVAL '1 hour'
        ) THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;

      WHEN 'perfectionist' THEN
        -- Check for perfect scores (ending in 000)
        SELECT COUNT(*) INTO perfect_score_count
        FROM scores s
        WHERE s.player_name = NEW.player_name
        AND s.score % 1000 = 0;
        
        IF perfect_score_count >= (achievement_record.criteria->>'min_perfect_scores')::INTEGER THEN
          INSERT INTO player_achievements (player_name, achievement_id, score_id)
          VALUES (NEW.player_name, achievement_record.id, NEW.id);
        END IF;
    END CASE;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the corrected check_achievements_on_game_play function
CREATE OR REPLACE FUNCTION check_achievements_on_game_play()
RETURNS TRIGGER AS $$
DECLARE
  achievement_record RECORD;
  player_stat RECORD;
BEGIN
  -- Get player stats
  SELECT * INTO player_stat FROM player_stats WHERE player_name = NEW.player_name;
  
  IF player_stat IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check game master achievement
  FOR achievement_record IN 
    SELECT * FROM achievements WHERE is_active = true AND type = 'game_master'
  LOOP
    -- Skip if player already has this achievement
    IF EXISTS (SELECT 1 FROM player_achievements WHERE player_name = NEW.player_name AND achievement_id = achievement_record.id) THEN
      CONTINUE;
    END IF;

    -- Check if player has played enough different games
    IF player_stat.total_games_played >= (achievement_record.criteria->>'min_games')::INTEGER THEN
      INSERT INTO player_achievements (player_name, achievement_id, score_id)
      VALUES (NEW.player_name, achievement_record.id, NEW.id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
CREATE TRIGGER update_player_stats
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION update_player_stats();

CREATE TRIGGER check_achievements_on_score
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION check_achievements_on_score();

CREATE TRIGGER check_achievements_on_game_play
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION check_achievements_on_game_play();
