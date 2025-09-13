-- Create the score_submissions table
CREATE TABLE IF NOT EXISTS public.score_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  score BIGINT NOT NULL,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_high_score BOOLEAN DEFAULT FALSE,
  previous_high_score BIGINT
);

-- Enable Row Level Security
ALTER TABLE public.score_submissions ENABLE ROW LEVEL SECURITY;

-- Create a function to notify clients about score submissions
CREATE OR REPLACE FUNCTION public.notify_score_submission()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'score_submissions',
    json_build_object(
      'event', 'score_submitted',
      'payload', json_build_object(
        'player_name', NEW.player_name,
        'score', NEW.score,
        'game_id', NEW.game_id,
        'tournament_id', NEW.tournament_id,
        'is_high_score', NEW.is_high_score,
        'previous_high_score', NEW.previous_high_score,
        'created_at', NEW.created_at
      )
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to notify on new score submissions
CREATE TRIGGER on_score_submitted
AFTER INSERT ON public.score_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_score_submission();

-- Grant necessary permissions
GRANT ALL ON public.score_submissions TO authenticated;
GRANT ALL ON public.score_submissions TO service_role;

-- Create policy to allow users to insert score submissions
CREATE POLICY "Allow insert for authenticated users" ON public.score_submissions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Create policy to allow public read access (for real-time subscriptions)
CREATE POLICY "Allow public read access" ON public.score_submissions
  FOR SELECT USING (true);
