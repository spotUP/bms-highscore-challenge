-- Diagnostic script to check tournament table structure and data
-- Run this to diagnose the 500 error issue

-- Check if tables exist
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE tablename IN ('tournaments', 'tournament_members', 'tournament_invitations')
ORDER BY tablename;

-- Check table structures
\d tournaments
\d tournament_members
\d tournament_invitations

-- Check if there's data in the tables
SELECT 'tournaments' as table_name, COUNT(*) as row_count FROM tournaments
UNION ALL
SELECT 'tournament_members' as table_name, COUNT(*) as row_count FROM tournament_members
UNION ALL
SELECT 'tournament_invitations' as table_name, COUNT(*) as row_count FROM tournament_invitations;

-- Check the actual data
SELECT 
  id,
  name,
  slug,
  is_public,
  created_by,
  created_at
FROM tournaments;

SELECT 
  tm.id,
  tm.tournament_id,
  tm.user_id,
  tm.role,
  tm.is_active,
  t.name as tournament_name
FROM tournament_members tm
LEFT JOIN tournaments t ON tm.tournament_id = t.id;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('tournaments', 'tournament_members', 'tournament_invitations')
ORDER BY tablename, policyname;

-- Test a simple query that should work
SELECT 
  tm.id,
  tm.role,
  t.name
FROM tournament_members tm
JOIN tournaments t ON tm.tournament_id = t.id
WHERE tm.is_active = true
LIMIT 5;
