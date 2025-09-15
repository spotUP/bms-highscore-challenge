-- ======================================
-- CRITICAL FIX: Create missing games and scores tables
-- Run this in Supabase Dashboard SQL Editor
-- ======================================

-- 1. Create games table
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

-- 2. Create scores table
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (LENGTH(player_name) <= 3),
  score INTEGER NOT NULL CHECK (score >= 0),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tournament_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create update trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_games_updated_at ON public.games;
CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_scores_updated_at ON public.scores;
CREATE TRIGGER update_scores_updated_at
BEFORE UPDATE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable RLS on both tables
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- 6. Create games table policies
DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;
CREATE POLICY "Games are viewable by everyone"
  ON public.games
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can create games" ON public.games;
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

DROP POLICY IF EXISTS "Admins can update games" ON public.games;
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

DROP POLICY IF EXISTS "Admins can delete games" ON public.games;
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

-- 7. Create scores table policies
DROP POLICY IF EXISTS "Scores are viewable by everyone" ON public.scores;
CREATE POLICY "Scores are viewable by everyone"
  ON public.scores
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can create scores" ON public.scores;
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

DROP POLICY IF EXISTS "Admins can update scores" ON public.scores;
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

DROP POLICY IF EXISTS "Admins can delete scores" ON public.scores;
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

-- 8. Insert sample games (optional)
INSERT INTO public.games (name, description, logo_url, is_active, include_in_challenge)
VALUES
  ('Pac-Man', 'Classic arcade game', '/images/pacman-logo.png', true, true),
  ('Donkey Kong', 'Jump and climb to save the princess', '/images/donkey-kong-logo.png', true, true),
  ('Space Invaders', 'Defend Earth from alien invaders', '/images/space-invaders-logo.png', true, true),
  ('Galaga', 'Space shooter game', NULL, true, true),
  ('Street Fighter II', 'Fighting game', NULL, true, true)
ON CONFLICT DO NOTHING;

-- 9. Verify tables were created
SELECT 'games' as table_name, count(*) as row_count FROM public.games
UNION ALL
SELECT 'scores' as table_name, count(*) as row_count FROM public.scores;