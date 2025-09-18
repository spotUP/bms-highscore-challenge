-- Make achievements per-tournament by scoping player_achievements with tournament_id
-- 1) Add tournament_id column (nullable initially), backfill from games, then make it NOT NULL

ALTER TABLE player_achievements
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;

-- Backfill tournament_id from the game that triggered the achievement, if game_id column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_achievements' AND column_name = 'game_id'
  ) THEN
    UPDATE player_achievements pa
    SET tournament_id = g.tournament_id
    FROM games g
    WHERE pa.game_id = g.id
      AND (pa.tournament_id IS NULL OR pa.tournament_id <> g.tournament_id);
  ELSE
    RAISE NOTICE 'Skipped backfill: player_achievements.game_id not found';
  END IF;
END
$$;

-- For any rows without a game_id (legacy), try to infer via latest score by player (best effort)
-- This is optional and best-effort; if no inference, leave NULL and keep unique upgrade safe.
-- You can comment this section out if not desired.
-- UPDATE player_achievements pa
-- SET tournament_id = s.tournament_id
-- FROM (
--   SELECT player_name, tournament_id
--   FROM scores
--   WHERE tournament_id IS NOT NULL
-- ) s
-- WHERE pa.tournament_id IS NULL AND pa.player_name = s.player_name;

-- 2) Drop old unique and replace with per-tournament unique key
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'player_achievements'
      AND c.conname = 'player_achievements_player_name_achievement_id_key'
  ) THEN
    ALTER TABLE player_achievements
      DROP CONSTRAINT player_achievements_player_name_achievement_id_key;
  END IF;
END
$$;

-- Create the new per-tournament uniqueness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'player_achievements'
      AND c.conname = 'player_achievements_player_name_achievement_id_tournament_id_key'
  ) THEN
    ALTER TABLE player_achievements
      ADD CONSTRAINT player_achievements_player_name_achievement_id_tournament_id_key
      UNIQUE (player_name, achievement_id, tournament_id);
  END IF;
END
$$;

-- 3) Update the function to scope by tournament and upsert idempotently on (player_name, achievement_id, tournament_id)
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
  -- Normalize player name (UPPER) for consistent uniqueness
  p_player_name := UPPER(COALESCE(p_player_name, ''));

  -- Resolve tournament id from the game
  SELECT tournament_id INTO v_tournament_id FROM games WHERE id = p_game_id;

  -- Get or create player stats (global stats, not per-tournament)
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

  -- Check for achievements (only those not yet awarded for this tournament)
  FOR achievement_record IN 
    SELECT * FROM achievements 
    WHERE is_active = true 
    AND id NOT IN (
      SELECT achievement_id FROM player_achievements 
      WHERE player_name = p_player_name AND tournament_id = v_tournament_id
    )
  LOOP
    DECLARE
      should_award BOOLEAN := false;
      awarded_id UUID;
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

      -- Award achievement if criteria met (idempotent per tournament)
      IF should_award THEN
        INSERT INTO player_achievements (player_name, achievement_id, tournament_id, game_id, score, metadata)
        VALUES (
          p_player_name,
          achievement_record.id,
          v_tournament_id,
          p_game_id,
          p_score,
          jsonb_build_object(
            'unlocked_via', achievement_record.type,
            'criteria_met', achievement_record.criteria
          )
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
