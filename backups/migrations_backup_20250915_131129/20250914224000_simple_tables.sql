-- Drop tables if they exist
DROP TABLE IF EXISTS public.scores CASCADE;
DROP TABLE IF EXISTS public.games CASCADE;

-- Create games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  tournament_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create scores table
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL CHECK (LENGTH(player_name) <= 3),
  score INTEGER NOT NULL CHECK (score >= 0),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tournament_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scores_updated_at
BEFORE UPDATE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on both tables
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Create basic policies (can be refined later)
CREATE POLICY "Enable read access for all users" ON public.games FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.scores FOR SELECT USING (true);

-- Insert some sample data
INSERT INTO public.games (name, description, is_active) VALUES
  ('Pac-Man', 'Classic arcade game', true),
  ('Space Invaders', 'Defend Earth from aliens', true),
  ('Donkey Kong', 'Jump over barrels', true);

-- Verify tables were created
SELECT 'Games table created with ' || COUNT(*) || ' rows' AS message FROM public.games;
