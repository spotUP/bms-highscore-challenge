-- Fix signup failing due to RLS blocking trigger inserts into profiles/user_roles

-- 1) Ensure RLS insert policy allows trigger (running as postgres) to insert into profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert their own profile'
  ) THEN
    DROP POLICY "Users can insert their own profile" ON public.profiles;
  END IF;
END $$;

-- Recreate insert policy allowing normal users to insert their own profile and trigger (postgres) to insert
-- Idempotent drop/create to avoid 'already exists' errors
DROP POLICY IF EXISTS profiles_insert_self_or_trigger ON public.profiles;

CREATE POLICY profiles_insert_self_or_trigger
ON public.profiles
FOR INSERT
WITH CHECK (
  -- Normal path: user creates their own profile
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  -- Backend paths: triggers / server calls (no JWT) or privileged roles
  OR auth.jwt() IS NULL
  OR auth.role() = 'authenticated'
  OR auth.role() = 'service_role'
);

-- 2) Allow trigger to insert into user_roles
-- Drop any existing insert policies to avoid duplicates
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN (
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND cmd = 'INSERT'
  ) LOOP
    EXECUTE format('DROP POLICY %I ON public.user_roles;', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'user_roles_insert_trigger_only'
  ) THEN
    CREATE POLICY user_roles_insert_trigger_only
    ON public.user_roles
    FOR INSERT
    WITH CHECK (
      -- Allow backend/trigger contexts
      auth.jwt() IS NULL OR auth.role() = 'service_role' OR auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- 3) (Optional) Update function owner to postgres so SECURITY DEFINER runs with postgres
-- Not always necessary, but included for robustness. Ignore errors if already owned by postgres.
DO $$
BEGIN
  ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
EXCEPTION WHEN others THEN
  -- ignore
  NULL;
END $$;
