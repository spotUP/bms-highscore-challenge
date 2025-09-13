-- Drop existing triggers and policies first to avoid conflicts
DROP TRIGGER IF EXISTS on_score_submitted ON public.score_submissions;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.score_submissions;
DROP POLICY IF EXISTS "Allow public read access" ON public.score_submissions;

-- Recreate the function that handles score submission notifications
CREATE OR REPLACE FUNCTION public.notify_score_submission()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'score_submissions',
    json_build_object(
      'event', 'INSERT',
      'id', NEW.id,
      'tournament_id', NEW.tournament_id,
      'game_id', NEW.game_id,
      'user_id', NEW.user_id,
      'score', NEW.score,
      'previous_high_score', NEW.previous_high_score,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_score_submitted
AFTER INSERT ON public.score_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_score_submission();

-- Recreate the policies
CREATE POLICY "Allow insert for authenticated users" ON public.score_submissions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow public read access" ON public.score_submissions
  FOR SELECT USING (true);

-- Add the scores_locked column to tournaments if it doesn't exist
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS scores_locked BOOLEAN NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.tournaments.scores_locked IS 'When true, prevents new score submissions for this tournament';
