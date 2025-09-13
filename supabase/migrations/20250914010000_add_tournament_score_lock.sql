-- Add score submission locking functionality to tournaments
-- This allows tournament admins to prevent new score submissions

ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS scores_locked BOOLEAN NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.tournaments.scores_locked IS 'When true, prevents new score submissions for this tournament';

-- Update the updated_at timestamp when scores_locked changes
CREATE OR REPLACE FUNCTION update_tournament_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS tournament_updated_at_trigger ON public.tournaments;
CREATE TRIGGER tournament_updated_at_trigger
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_updated_at();
