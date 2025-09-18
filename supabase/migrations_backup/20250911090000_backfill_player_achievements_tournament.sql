-- Backfill player_achievements.tournament_id from achievements.tournament_id (no manual UUIDs required)

-- 1) Populate tournament_id on player_achievements where missing, using the linked achievement's tournament
UPDATE player_achievements pa
SET tournament_id = a.tournament_id
FROM achievements a
WHERE pa.achievement_id = a.id
  AND pa.tournament_id IS NULL
  AND a.tournament_id IS NOT NULL;

-- 2) Optional: report how many still NULL after backfill (for visibility in logs)
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining FROM player_achievements WHERE tournament_id IS NULL;
  RAISE NOTICE 'player_achievements remaining with NULL tournament_id: %', remaining;
END $$;
