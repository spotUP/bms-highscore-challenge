-- Per-tournament Achievements with Auto-Population on Tournament Creation
-- 1) Add tournament_id to achievements; treat rows with NULL tournament_id as templates

ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

-- Optional: ensure no duplicate names per tournament
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'achievements'
      AND c.conname = 'achievements_tournament_id_name_key'
  ) THEN
    ALTER TABLE achievements
      ADD CONSTRAINT achievements_tournament_id_name_key UNIQUE (tournament_id, name);
  END IF;
END
$$;

-- 2) Function to populate default (template) achievements for a tournament
CREATE OR REPLACE FUNCTION populate_default_achievements(p_tournament_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Insert copies of template achievements (where tournament_id IS NULL) into this tournament
  INSERT INTO achievements (name, description, type, badge_icon, badge_color, criteria, points, is_active, tournament_id)
  SELECT a.name, a.description, a.type, a.badge_icon, a.badge_color, a.criteria, a.points, a.is_active, p_tournament_id
  FROM achievements a
  WHERE a.tournament_id IS NULL
  ON CONFLICT (tournament_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Trigger to auto-populate achievements when a new tournament is created
CREATE OR REPLACE FUNCTION trigger_on_tournament_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM populate_default_achievements(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_tournament_created_populate_achievements ON tournaments;
CREATE TRIGGER on_tournament_created_populate_achievements
AFTER INSERT ON tournaments
FOR EACH ROW
EXECUTE FUNCTION trigger_on_tournament_created();

-- 4) Backfill: ensure every existing tournament has a set copied from templates
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tournaments LOOP
    PERFORM populate_default_achievements(t.id);
  END LOOP;
END;
$$;

-- 5) Update check_and_award_achievements to use per-tournament achievements only
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
  v_tournament_id UUID;
BEGIN
  -- Normalize player name
  p_player_name := UPPER(COALESCE(p_player_name, ''));
  -- Resolve tournament id from the game
  SELECT tournament_id INTO v_tournament_id FROM games WHERE id = p_game_id;

  -- Player stats (kept global)
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

  -- Only consider achievements for this tournament (rows copied from templates)
  FOR achievement_record IN 
    SELECT * FROM achievements 
    WHERE is_active = true 
      AND tournament_id = v_tournament_id
      AND id NOT IN (
        SELECT achievement_id FROM player_achievements 
        WHERE player_name = p_player_name AND tournament_id = v_tournament_id
      )
  LOOP
    DECLARE
      should_award BOOLEAN := false;
      awarded_id UUID;
    BEGIN
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

      IF should_award THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, game_id, score, metadata)
        VALUES (
          p_player_name,
          achievement_record.id,
          v_tournament_id,
          p_game_id,
          p_score,
          jsonb_build_object('unlocked_via', achievement_record.type, 'criteria_met', achievement_record.criteria)
        )
        ON CONFLICT (player_name, achievement_id, tournament_id) DO NOTHING
        RETURNING id INTO awarded_id;

        IF awarded_id IS NOT NULL THEN
          achievement_count := achievement_count + 1;
          new_achievements := new_achievements || jsonb_build_object(
            'id', achievement_record.id,
            'name', achievement_record.name,
            'description', achievement_record.description,
            'badge_icon', achievement_record.badge_icon,
            'badge_color', achievement_record.badge_color,
            'points', achievement_record.points
          );
        END IF;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'new_achievements', new_achievements,
    'achievement_count', achievement_count,
    'player_stats', row_to_json(player_stat_record)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
