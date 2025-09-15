-- Enable RLS on storage.* tables only when policies exist and RLS is currently disabled
-- Safe: does not touch tables without policies

begin;

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
    WHERE c.relkind = 'r'
      AND c.relrowsecurity = false
      AND p.schemaname = 'storage'
  ) LOOP
    qualified := format('%I.%I', r.schemaname, r.tablename);
    RAISE NOTICE 'Enabling RLS on %', qualified;
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', qualified);
  END LOOP;
END $$;

commit;
