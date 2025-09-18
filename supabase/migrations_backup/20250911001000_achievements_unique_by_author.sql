-- Tighten uniqueness to (name, tournament_id, created_by) and enforce NOT NULL on created_by

-- 0) Ensure created_by exists and is backfilled (safety if previous migration hasn't run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.achievements ADD COLUMN created_by uuid;
    -- Best-effort backfill from tournaments
    UPDATE public.achievements a
    SET created_by = t.created_by
    FROM public.tournaments t
    WHERE a.tournament_id = t.id
      AND a.created_by IS NULL;
  END IF;
END $$;

-- 1) Backfill any remaining NULLs just in case
UPDATE public.achievements a
SET created_by = t.created_by
FROM public.tournaments t
WHERE a.tournament_id = t.id
  AND a.created_by IS NULL;

-- 2) Enforce NOT NULL on created_by
ALTER TABLE public.achievements
  ALTER COLUMN created_by SET NOT NULL;

-- 3) Drop old uniqueness on (name, tournament_id) if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.achievements'::regclass
      AND contype = 'u'
      AND conname = 'achievements_name_tournament_unique'
  ) THEN
    ALTER TABLE public.achievements
      DROP CONSTRAINT achievements_name_tournament_unique;
  END IF;
END $$;

-- 4) Create new unique constraint on (name, tournament_id, created_by)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.achievements'::regclass
      AND contype = 'u'
      AND conname = 'achievements_name_tournament_author_unique'
  ) THEN
    ALTER TABLE public.achievements
      ADD CONSTRAINT achievements_name_tournament_author_unique
      UNIQUE (name, tournament_id, created_by);
  END IF;
END $$;

-- 5) Ensure index exists to support typical queries (owner + tournament)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'achievements_created_by_tournament_idx'
  ) THEN
    CREATE INDEX achievements_created_by_tournament_idx 
      ON public.achievements (created_by, tournament_id);
  END IF;
END $$;
