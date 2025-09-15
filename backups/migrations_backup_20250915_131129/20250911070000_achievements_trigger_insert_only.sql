-- Restrict achievement awarding trigger to INSERTs only to avoid re-awarding on score edits

-- Drop the existing trigger (if any)
DROP TRIGGER IF EXISTS achievement_check_trigger ON scores;

-- Recreate as AFTER INSERT only, but only if the trigger function exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'trigger_achievement_check'
  ) THEN
    CREATE TRIGGER achievement_check_trigger
      AFTER INSERT ON scores
      FOR EACH ROW
      EXECUTE FUNCTION trigger_achievement_check();
  ELSE
    RAISE NOTICE 'Skipped creating achievement_check_trigger: trigger_achievement_check() not found';
  END IF;
END
$$;
