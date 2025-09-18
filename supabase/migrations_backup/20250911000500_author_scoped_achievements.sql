-- Author-scoped achievements migration
-- Ensures achievements are owned by their creator and only visible/manipulable by them
-- Also backfills created_by for existing rows and adds RLS policies

-- 1) Add created_by column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'achievements' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.achievements
      ADD COLUMN created_by uuid;
  END IF;
END $$;

-- 2) Backfill created_by from tournaments.created_by where possible
--    This assumes each achievement belongs to a tournament and should be attributed to that tournament's creator
UPDATE public.achievements a
SET created_by = t.created_by
FROM public.tournaments t
WHERE a.tournament_id = t.id
  AND a.created_by IS NULL;

-- 3) Create index to speed up queries by owner and tournament
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

-- 4) Enable RLS on achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- 5) Drop existing permissive policies that may conflict (best-effort)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN (
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'achievements'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.achievements;', pol.policyname);
  END LOOP;
END $$;

-- 6) Create strict RLS policies for achievements
--    a) Select only own achievements
CREATE POLICY achievements_select_own
ON public.achievements
FOR SELECT
USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

--    b) Insert: must set created_by to self (or leave null and trigger sets it)
CREATE POLICY achievements_insert_self
ON public.achievements
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (created_by IS NULL OR created_by = auth.uid()));

--    c) Update only own
CREATE POLICY achievements_update_own
ON public.achievements
FOR UPDATE
USING (auth.uid() IS NOT NULL AND created_by = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

--    d) Delete only own
CREATE POLICY achievements_delete_own
ON public.achievements
FOR DELETE
USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- 7) Ensure created_by gets set to auth.uid() by default on insert (when client forgets)
--    Create helper function and trigger
CREATE OR REPLACE FUNCTION public.set_achievement_creator()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_achievement_creator ON public.achievements;
CREATE TRIGGER trg_set_achievement_creator
BEFORE INSERT ON public.achievements
FOR EACH ROW
EXECUTE FUNCTION public.set_achievement_creator();

-- 8) Optional: tighten duplicate uniqueness to include created_by if you want per-user names
--    Leaving existing name+tournament_id unique constraint in place to preserve current behavior.
--    Uncomment below if you want per-author uniqueness instead of per-tournament.
-- -- DROP INDEX IF EXISTS achievements_name_tournament_unique;
-- -- CREATE UNIQUE INDEX achievements_name_tournament_author_unique
-- --   ON public.achievements (name, tournament_id, created_by);

-- 9) Make sure RPCs naturally respect RLS by using SECURITY INVOKER (default) or remove SECURITY DEFINER
--    If you have functions that select from achievements with SECURITY DEFINER, consider changing them.
--    Below we recreate get_tournament_achievements as SECURITY INVOKER so RLS applies.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_tournament_achievements'
  ) THEN
    DROP FUNCTION public.get_tournament_achievements(p_tournament_id uuid);
  END IF;
END $$;

CREATE FUNCTION public.get_tournament_achievements(p_tournament_id uuid)
RETURNS SETOF public.achievements
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT *
  FROM public.achievements
  WHERE tournament_id = p_tournament_id
  ORDER BY created_at DESC;
$$;

-- Note: With SECURITY INVOKER, the caller's RLS context will filter rows to only those where created_by = auth.uid().
-- Ensure clients call this function with an authenticated session for proper scoping.
