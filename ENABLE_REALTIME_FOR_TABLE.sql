-- Enable real-time for the score_submissions table
-- This adds the table to the supabase_realtime publication

-- First, check what tables are currently in the realtime publication
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- Add score_submissions table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE score_submissions;

-- Verify it was added
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'score_submissions';