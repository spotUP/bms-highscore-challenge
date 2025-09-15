-- Fix bracket_matches table and policies to use tournament_id instead of competition_id
-- This handles the policy dependencies that prevent dropping competition_id column

-- Drop existing RLS policies that depend on competition_id
DROP POLICY IF EXISTS bracket_matches_select ON public.bracket_matches;
DROP POLICY IF EXISTS bracket_matches_mutate ON public.bracket_matches;

-- Update the table structure
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

    -- Now we can drop the competition_id column since policies are gone
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

-- Recreate RLS policies for bracket_matches using tournament_id
CREATE POLICY bracket_matches_select ON public.bracket_matches
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND (t.is_public OR t.created_by = auth.uid()))
  );

CREATE POLICY bracket_matches_mutate ON public.bracket_matches
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
  );

-- Verify the fix
SELECT
  'Column check:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bracket_matches'
AND table_schema = 'public'
AND column_name IN ('tournament_id', 'competition_id')
ORDER BY column_name;

-- Show policies
SELECT
  'Policy check:' as info,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'bracket_matches'
AND schemaname = 'public';