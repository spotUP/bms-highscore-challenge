-- Remove Default Arcade Tournament and all associated data
-- WARNING: This operation is IRREVERSIBLE and will delete:
-- - The tournament record
-- - All games in the tournament
-- - All scores in the tournament
-- - All achievements in the tournament
-- - All player achievements in the tournament
-- - All player stats in the tournament

DO $$
DECLARE
  default_tournament_id UUID;
  games_deleted INTEGER := 0;
  scores_deleted INTEGER := 0;
  achievements_deleted INTEGER := 0;
  player_achievements_deleted INTEGER := 0;
  player_stats_deleted INTEGER := 0;
  members_removed INTEGER := 0;
BEGIN
  -- Find the default tournament
  SELECT id INTO default_tournament_id
  FROM public.tournaments
  WHERE name = 'Default Arcade Tournament' OR slug = 'default-arcade'
  LIMIT 1;

  -- Check if tournament exists
  IF default_tournament_id IS NULL THEN
    RAISE EXCEPTION 'Default Arcade Tournament not found. Nothing to remove.';
  END IF;

  RAISE NOTICE 'Found Default Arcade Tournament: %', default_tournament_id;
  RAISE NOTICE '⚠️  WARNING: This will permanently delete all data associated with this tournament!';
  RAISE NOTICE 'Starting deletion process...';

  -- Step 1: Delete player achievements (must be done first due to foreign keys)
  DELETE FROM public.player_achievements
  WHERE tournament_id = default_tournament_id;

  GET DIAGNOSTICS player_achievements_deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted % player achievements', player_achievements_deleted;

  -- Step 2: Delete scores (this will cascade to related records)
  DELETE FROM public.scores
  WHERE tournament_id = default_tournament_id;

  GET DIAGNOSTICS scores_deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted % scores', scores_deleted;

  -- Step 3: Delete achievements
  DELETE FROM public.achievements
  WHERE tournament_id = default_tournament_id;

  GET DIAGNOSTICS achievements_deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted % achievements', achievements_deleted;

  -- Step 4: Delete games
  DELETE FROM public.games
  WHERE tournament_id = default_tournament_id;

  GET DIAGNOSTICS games_deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted % games', games_deleted;

  -- Step 5: Delete player stats
  DELETE FROM public.player_stats
  WHERE tournament_id = default_tournament_id;

  GET DIAGNOSTICS player_stats_deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted % player stats', player_stats_deleted;

  -- Step 6: Remove all tournament members
  DELETE FROM public.tournament_members
  WHERE tournament_id = default_tournament_id;

  GET DIAGNOSTICS members_removed = ROW_COUNT;
  RAISE NOTICE 'Removed % tournament members', members_removed;

  -- Step 7: Finally, delete the tournament itself
  DELETE FROM public.tournaments
  WHERE id = default_tournament_id;

  -- Verify tournament is gone
  IF NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = default_tournament_id) THEN
    RAISE NOTICE '✅ Default Arcade Tournament successfully removed!';
  ELSE
    RAISE EXCEPTION '❌ Failed to remove tournament - it still exists!';
  END IF;

  -- Final summary
  RAISE NOTICE '🎯 Deletion Summary:';
  RAISE NOTICE '  • Games: %', games_deleted;
  RAISE NOTICE '  • Scores: %', scores_deleted;
  RAISE NOTICE '  • Achievements: %', achievements_deleted;
  RAISE NOTICE '  • Player Achievements: %', player_achievements_deleted;
  RAISE NOTICE '  • Player Stats: %', player_stats_deleted;
  RAISE NOTICE '  • Tournament Members: %', members_removed;
  RAISE NOTICE '  • Tournament: 1 (Default Arcade Tournament)';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Tip: If you want to restore this data, you would need to re-run the original migration and data population scripts.';

END $$;

-- Verification: Show remaining tournaments
SELECT
  'Remaining Tournaments:' as info,
  COUNT(*) as count
FROM public.tournaments;

-- Show remaining tournament details
SELECT
  id,
  name,
  slug,
  created_at
FROM public.tournaments
ORDER BY created_at;
