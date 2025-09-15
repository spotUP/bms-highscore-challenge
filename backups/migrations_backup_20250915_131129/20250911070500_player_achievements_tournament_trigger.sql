-- Auto-populate player_achievements.tournament_id on INSERT
-- Derive from the linked achievement's tournament_id if not provided

-- 1) Create or replace trigger function
CREATE OR REPLACE FUNCTION set_player_achievements_tournament_id()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament_id uuid;
BEGIN
  -- If tournament_id already provided, keep it
  IF NEW.tournament_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Lookup from achievements
  SELECT a.tournament_id INTO v_tournament_id
  FROM achievements a
  WHERE a.id = NEW.achievement_id;

  -- Set when available
  IF v_tournament_id IS NOT NULL THEN
    NEW.tournament_id := v_tournament_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Drop and recreate trigger
DROP TRIGGER IF EXISTS trg_set_player_achievements_tournament_id ON player_achievements;
CREATE TRIGGER trg_set_player_achievements_tournament_id
BEFORE INSERT ON player_achievements
FOR EACH ROW
EXECUTE FUNCTION set_player_achievements_tournament_id();
