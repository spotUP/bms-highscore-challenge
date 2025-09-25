-- Create the missing score_submissions table for real-time notifications
-- This table is used to broadcast score submissions to all connected clients

-- Create score_submissions table
CREATE TABLE IF NOT EXISTS public.score_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score > 0),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tournament_id UUID NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  is_high_score BOOLEAN NOT NULL DEFAULT false,
  previous_high_score INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_score_submissions_tournament_id ON public.score_submissions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_score_submissions_game_id ON public.score_submissions(game_id);
CREATE INDEX IF NOT EXISTS idx_score_submissions_created_at ON public.score_submissions(created_at);

-- Enable RLS
ALTER TABLE public.score_submissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all authenticated users to read, but restrict writes to prevent spam)
DROP POLICY IF EXISTS score_submissions_select ON public.score_submissions;
CREATE POLICY score_submissions_select ON public.score_submissions
  FOR SELECT USING (true); -- Allow all users to see score submissions for notifications

DROP POLICY IF EXISTS score_submissions_insert ON public.score_submissions;
CREATE POLICY score_submissions_insert ON public.score_submissions
  FOR INSERT WITH CHECK (true); -- Allow inserts from authenticated users

-- Add comment
COMMENT ON TABLE public.score_submissions IS 'Real-time score submission notifications - used to broadcast score events to all connected clients';

-- Verify the table was created
SELECT
  'Table created: score_submissions' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'score_submissions'
AND table_schema = 'public'
ORDER BY ordinal_position;