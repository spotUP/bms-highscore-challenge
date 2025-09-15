-- Fix bracket_matches table to have all required columns
-- This fixes the error: Could not find the 'winner_id' column of 'bracket_matches' in the schema cache

-- Add missing columns to bracket_matches table
DO $$
BEGIN
  -- Add winner_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'winner_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.bracket_matches ADD COLUMN winner_id UUID REFERENCES public.bracket_players(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added winner_id column to bracket_matches table';
  END IF;

  -- Add winner_participant_id column if it doesn't exist (for consistency with code)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'winner_participant_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.bracket_matches ADD COLUMN winner_participant_id UUID REFERENCES public.bracket_players(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added winner_participant_id column to bracket_matches table';
  END IF;

  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'status'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.bracket_matches ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed'));
    RAISE NOTICE 'Added status column to bracket_matches table';
  END IF;

  -- Add reported_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'reported_by'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.bracket_matches ADD COLUMN reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added reported_by column to bracket_matches table';
  END IF;

  -- Add reported_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'reported_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.bracket_matches ADD COLUMN reported_at TIMESTAMPTZ NULL;
    RAISE NOTICE 'Added reported_at column to bracket_matches table';
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'created_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.bracket_matches ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE 'Added created_at column to bracket_matches table';
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'updated_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.bracket_matches ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column to bracket_matches table';
  END IF;
END $$;

-- Verify all columns exist
SELECT
  'Column verification:' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bracket_matches'
AND table_schema = 'public'
ORDER BY ordinal_position;