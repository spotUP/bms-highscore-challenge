-- Enable RLS only for tables that already have policies defined but currently have RLS disabled
-- This addresses SUPA_policy_exists_rls_disabled without changing tables that do not use RLS.
-- Safe-by-default: only toggles relrowsecurity on tables that already have policies authored.

begin;

-- Iterate over all tables that have policies but RLS is not enabled yet
DO $$
DECLARE
  r record;
  qualified text;
BEGIN
  FOR r IN (
    SELECT DISTINCT p.schemaname, p.tablename
    FROM pg_policies p
    JOIN pg_class c ON c.relname = p.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = p.schemaname
    WHERE c.relkind = 'r' -- ordinary tables
      AND c.relrowsecurity = false
  ) LOOP
    qualified := format('%I.%I', r.schemaname, r.tablename);
    RAISE NOTICE 'Enabling RLS on %', qualified;
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', qualified);
  END LOOP;
END $$;

commit;
