-- Add tournament scoping to all existing tables
-- This migration adds tournament_id to existing tables and migrates data

-- Add tournament_id to games table
ALTER TABLE public.games ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to scores table
ALTER TABLE public.scores ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to achievements table
ALTER TABLE public.achievements ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to player_achievements table
ALTER TABLE public.player_achievements ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to player_stats table
ALTER TABLE public.player_stats ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to competition_history table
ALTER TABLE public.competition_history ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to competition_games table
ALTER TABLE public.competition_games ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to competition_scores table
ALTER TABLE public.competition_scores ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Add tournament_id to competition_players table
ALTER TABLE public.competition_players ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- Create a default tournament for existing data migration
DO $$
DECLARE
  default_tournament_id UUID;
  first_admin_id UUID;
BEGIN
  -- Get the first admin user to own the default tournament
  SELECT user_id INTO first_admin_id 
  FROM public.user_roles 
  WHERE role = 'admin' 
  ORDER BY created_at 
  LIMIT 1;
  
  -- If no admin found, use the first user
  IF first_admin_id IS NULL THEN
    SELECT id INTO first_admin_id 
    FROM auth.users 
    ORDER BY created_at 
    LIMIT 1;
  END IF;
  
  -- Create default tournament only if we have a user and it doesn't exist
  IF first_admin_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tournaments WHERE slug = 'default-arcade') THEN
    INSERT INTO public.tournaments (
      id,
      name,
      description,
      slug,
      owner_id,
      is_public,
      is_active
    ) VALUES (
      gen_random_uuid(),
      'Default Arcade Tournament',
      'Legacy arcade tournament - migrated from single-user system',
      'default-arcade',
      first_admin_id,
      true,
      true
    ) RETURNING id INTO default_tournament_id;
    
    -- Add the owner as a member
    INSERT INTO public.tournament_members (
      tournament_id,
      user_id,
      role,
      is_active
    ) VALUES (
      default_tournament_id,
      first_admin_id,
      'owner',
      true
    );
    
    -- Migrate existing data to the default tournament
    UPDATE public.games SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
    UPDATE public.scores SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
    UPDATE public.achievements SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
    UPDATE public.player_achievements SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
    UPDATE public.player_stats SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
    UPDATE public.competition_history SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
    UPDATE public.competition_games SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
    UPDATE public.competition_scores SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
    UPDATE public.competition_players SET tournament_id = default_tournament_id WHERE tournament_id IS NULL;
  END IF;
END $$;

-- Make tournament_id NOT NULL after migration
ALTER TABLE public.games ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.scores ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.achievements ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.player_achievements ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.player_stats ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.competition_history ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.competition_games ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.competition_scores ALTER COLUMN tournament_id SET NOT NULL;
ALTER TABLE public.competition_players ALTER COLUMN tournament_id SET NOT NULL;

-- Add indexes for tournament scoping
CREATE INDEX idx_games_tournament ON public.games(tournament_id);
CREATE INDEX idx_scores_tournament ON public.scores(tournament_id);
CREATE INDEX idx_achievements_tournament ON public.achievements(tournament_id);
CREATE INDEX idx_player_achievements_tournament ON public.player_achievements(tournament_id);
CREATE INDEX idx_player_stats_tournament ON public.player_stats(tournament_id);
CREATE INDEX idx_competition_history_tournament ON public.competition_history(tournament_id);
CREATE INDEX idx_competition_games_tournament ON public.competition_games(tournament_id);
CREATE INDEX idx_competition_scores_tournament ON public.competition_scores(tournament_id);
CREATE INDEX idx_competition_players_tournament ON public.competition_players(tournament_id);

-- Add composite indexes for common queries
CREATE INDEX idx_games_tournament_active ON public.games(tournament_id, is_active);
CREATE INDEX idx_games_tournament_challenge ON public.games(tournament_id, include_in_challenge);
CREATE INDEX idx_scores_tournament_game ON public.scores(tournament_id, game_id);
CREATE INDEX idx_scores_tournament_player ON public.scores(tournament_id, player_name);
CREATE INDEX idx_player_achievements_tournament_player ON public.player_achievements(tournament_id, player_name);
CREATE INDEX idx_competition_scores_tournament_competition ON public.competition_scores(tournament_id, competition_id);
