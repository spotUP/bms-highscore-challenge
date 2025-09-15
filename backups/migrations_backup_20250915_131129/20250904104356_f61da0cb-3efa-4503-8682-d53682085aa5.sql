-- Add column to track which games are included in highscore challenges
ALTER TABLE public.games 
ADD COLUMN include_in_challenge boolean NOT NULL DEFAULT false;

-- Add a comment to explain the column
COMMENT ON COLUMN public.games.include_in_challenge IS 'Whether this game is included in the current highscore challenge';