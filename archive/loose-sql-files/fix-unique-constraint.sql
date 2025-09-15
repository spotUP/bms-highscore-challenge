-- Fix the unique_player_game constraint issue
-- This script safely handles the constraint creation/removal

DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  -- Check if the constraint already exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'scores'
      AND constraint_name = 'unique_player_game'
      AND table_schema = 'public'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    RAISE NOTICE 'Constraint unique_player_game already exists. Dropping it first...';

    -- Drop the existing constraint
    ALTER TABLE public.scores DROP CONSTRAINT unique_player_game;

    RAISE NOTICE 'Existing constraint dropped successfully.';
  ELSE
    RAISE NOTICE 'Constraint unique_player_game does not exist. Proceeding with creation.';
  END IF;

  -- Clean up any duplicate scores (keeping only the highest score per player per game)
  RAISE NOTICE 'Cleaning up duplicate scores...';
  DELETE FROM public.scores
  WHERE id NOT IN (
    SELECT DISTINCT ON (player_name, game_id) id
    FROM public.scores
    ORDER BY player_name, game_id, score DESC
  );

  GET DIAGNOSTICS constraint_exists = ROW_COUNT;
  RAISE NOTICE 'Removed % duplicate score(s)', constraint_exists;

  -- Now add the unique constraint
  RAISE NOTICE 'Adding unique constraint...';
  ALTER TABLE public.scores
  ADD CONSTRAINT unique_player_game UNIQUE (player_name, game_id);

  RAISE NOTICE '✅ Unique constraint unique_player_game created successfully!';

  -- Verify the constraint was created
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'scores'
      AND constraint_name = 'unique_player_game'
      AND table_schema = 'public'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    RAISE NOTICE '✅ Verification: Constraint exists and is active.';
  ELSE
    RAISE EXCEPTION '❌ Verification failed: Constraint was not created properly.';
  END IF;

END $$;

-- Show current constraints on the scores table for verification
SELECT
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_name = 'scores'
  AND table_schema = 'public'
ORDER BY constraint_name;
