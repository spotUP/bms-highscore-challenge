-- MANUAL FIX: Run this directly in Supabase Dashboard > SQL Editor
-- This will completely disable RLS on score_submissions table

-- First, drop all existing policies
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.score_submissions;
DROP POLICY IF EXISTS "Allow insert for all users" ON public.score_submissions;
DROP POLICY IF EXISTS "Allow public read access" ON public.score_submissions;
DROP POLICY IF EXISTS "score_submissions_insert_policy" ON public.score_submissions;
DROP POLICY IF EXISTS "score_submissions_select_policy" ON public.score_submissions;

-- Completely disable RLS on the table
ALTER TABLE public.score_submissions DISABLE ROW LEVEL SECURITY;

-- Verify the table structure
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'score_submissions';

-- Show any remaining policies (should be empty)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'score_submissions';
