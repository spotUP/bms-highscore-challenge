-- Check RLS policies and real-time settings for score_submissions table

-- 1. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'score_submissions';

-- 2. Check RLS policies
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
WHERE tablename = 'score_submissions';

-- 3. Check if the table has the realtime publication enabled
SELECT
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'score_submissions';

-- 4. Verify table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'score_submissions'
AND table_schema = 'public'
ORDER BY ordinal_position;