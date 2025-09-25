-- Fix bracket_matches table to have tournament_id column instead of competition_id
-- This fixes the error: column bracket_matches.tournament_id does not exist

-- Check if bracket_matches has competition_id and needs to be updated
DO $$
BEGIN
  -- If bracket_matches has competition_id column, update it to tournament_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'competition_id'
    AND table_schema = 'public'
  ) THEN
    -- First, add tournament_id column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'bracket_matches'
      AND column_name = 'tournament_id'
      AND table_schema = 'public'
    ) THEN
      ALTER TABLE public.bracket_matches ADD COLUMN tournament_id UUID;
    END IF;

    -- Copy data from competition_id to tournament_id
    UPDATE public.bracket_matches
    SET tournament_id = competition_id
    WHERE tournament_id IS NULL AND competition_id IS NOT NULL;

    -- Drop the old foreign key constraint for competition_id
    ALTER TABLE public.bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_competition_id_fkey;

    -- Drop the competition_id column
    ALTER TABLE public.bracket_matches DROP COLUMN IF EXISTS competition_id;

    -- Make tournament_id NOT NULL
    ALTER TABLE public.bracket_matches ALTER COLUMN tournament_id SET NOT NULL;

    -- Add foreign key constraint for tournament_id
    ALTER TABLE public.bracket_matches
    ADD CONSTRAINT bracket_matches_tournament_id_fkey
    FOREIGN KEY (tournament_id) REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE;

    RAISE NOTICE 'Updated bracket_matches table: competition_id -> tournament_id';

  -- If bracket_matches doesn't have tournament_id column, add it
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'tournament_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.bracket_matches ADD COLUMN tournament_id UUID NOT NULL REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added tournament_id column to bracket_matches table';
  ELSE
    RAISE NOTICE 'bracket_matches table already has tournament_id column';
  END IF;
END $$;

-- Verify the fix
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bracket_matches'
AND table_schema = 'public'
AND column_name IN ('tournament_id', 'competition_id')
ORDER BY column_name;