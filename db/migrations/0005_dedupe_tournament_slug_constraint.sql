-- tournaments.slug carried two identical UNIQUE constraints
-- (tournaments_slug_key and tournaments_slug_unique). One is enough: the
-- duplicate costs a second index on every write, and a violation could be
-- reported under either name, which made error handling unreliable.
--
-- Re-runnable: the deploy applies every migration file on each deploy.

ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_slug_unique;

-- Guarantee the surviving constraint exists, whatever the database started from.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tournaments'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.tournaments'::regclass AND attname = 'slug'
      )]
  ) THEN
    ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_slug_key UNIQUE (slug);
  END IF;
END
$$;
