-- Check current RLS policies for scores table
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
WHERE tablename = 'scores';

-- Check if RLS is enabled
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('scores', 'games', 'tournaments');

-- Check current user and their roles
SELECT current_user, current_role;

-- Test scores table structure
\d scores;