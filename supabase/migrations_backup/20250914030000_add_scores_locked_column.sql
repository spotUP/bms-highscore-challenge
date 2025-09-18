-- Add the scores_locked column to tournaments if it doesn't exist
DO $$
BEGIN
  -- Check if the column already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tournaments' 
    AND column_name = 'scores_locked'
  ) THEN
    -- Add the column if it doesn't exist
    ALTER TABLE public.tournaments 
    ADD COLUMN scores_locked BOOLEAN NOT NULL DEFAULT false;

    -- Add comment for clarity
    COMMENT ON COLUMN public.tournaments.scores_locked IS 'When true, prevents new score submissions for this tournament';
    
    RAISE NOTICE 'Added scores_locked column to tournaments table';
  ELSE
    RAISE NOTICE 'scores_locked column already exists in tournaments table';
  END IF;
END $$;
