-- Add unique constraint to prevent duplicate achievement names per tournament (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'achievements_name_tournament_unique'
      AND conrelid = 'public.achievements'::regclass
  ) THEN
    ALTER TABLE public.achievements
    ADD CONSTRAINT achievements_name_tournament_unique
    UNIQUE (name, tournament_id);
  END IF;
END $$;
