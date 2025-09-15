-- Simple test to check tournament table access
-- Run this to verify basic database connectivity

-- Test 1: Check if tables exist
SELECT
  'tournaments' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments') THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT
  'tournament_members' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_members') THEN 'EXISTS' ELSE 'MISSING' END as status;

-- Test 2: Try simple selects (these should work even with RLS disabled)
SELECT COUNT(*) as tournament_count FROM public.tournaments;
SELECT COUNT(*) as member_count FROM public.tournament_members;

-- Test 3: Check your specific user
SELECT
  tm.id,
  tm.user_id,
  tm.tournament_id,
  tm.role,
  tm.is_active,
  t.name as tournament_name
FROM public.tournament_members tm
LEFT JOIN public.tournaments t ON tm.tournament_id = t.id
WHERE tm.user_id = '6a5550ca-ec3e-413d-9a9b-e20ec827f045';

-- Test 4: Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('tournaments', 'tournament_members')
ORDER BY tablename;
