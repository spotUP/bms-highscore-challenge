-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  include_in_challenge BOOLEAN NOT NULL DEFAULT true,
  tournament_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scores table
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (LENGTH(player_name) <= 3),
  score INTEGER NOT NULL CHECK (score >= 0),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tournament_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scores_updated_at
BEFORE UPDATE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on both tables
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Create games table policies
-- Allow everyone to view games
CREATE POLICY "Games are viewable by everyone"
  ON public.games
  FOR SELECT
  USING (true);

-- Only admins can insert games
CREATE POLICY "Admins can create games"
  ON public.games
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );

-- Only admins can update games
CREATE POLICY "Admins can update games"
  ON public.games
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );

-- Only admins can delete games
CREATE POLICY "Admins can delete games"
  ON public.games
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );

-- Create scores table policies
-- Allow everyone to view scores
CREATE POLICY "Scores are viewable by everyone" 
  ON public.scores 
  FOR SELECT 
  USING (true);

-- Only admins can insert scores
CREATE POLICY "Admins can create scores" 
  ON public.scores 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
  );

-- Only admins can update scores
CREATE POLICY "Admins can update scores" 
  ON public.scores 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
  );

-- Only admins can delete scores
CREATE POLICY "Admins can delete scores" 
  ON public.scores 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
  );
