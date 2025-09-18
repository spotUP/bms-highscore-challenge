-- Consolidate and fix bracket table schema
-- This migration properly handles the transition from bracket_competitions/bracket_participants
-- to bracket_tournaments/bracket_players that the application code expects

-- First, create the new tables with correct names if they don't exist
CREATE TABLE IF NOT EXISTS public.bracket_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
  bracket_type TEXT NOT NULL DEFAULT 'single' CHECK (bracket_type IN ('single','double')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bracket_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  seed INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate data from old table names if they exist
DO $$
BEGIN
  -- Migrate bracket_competitions to bracket_tournaments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bracket_competitions' AND table_schema = 'public') THEN
    INSERT INTO public.bracket_tournaments (id, name, created_by, is_public, is_locked, status, created_at, updated_at)
    SELECT id, name, created_by, is_public, is_locked, status, created_at, updated_at
    FROM public.bracket_competitions
    ON CONFLICT (id) DO NOTHING;

    -- Add bracket_type column if it doesn't exist on the old table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bracket_competitions' AND column_name = 'bracket_type') THEN
      UPDATE public.bracket_tournaments SET bracket_type = 'single' WHERE bracket_type IS NULL;
    END IF;
  END IF;

  -- Migrate bracket_participants to bracket_players
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bracket_participants' AND table_schema = 'public') THEN
    INSERT INTO public.bracket_players (id, tournament_id, user_id, name, seed, created_at)
    SELECT
      p.id,
      p.competition_id as tournament_id,
      p.user_id,
      COALESCE(p.display_name, p.name, 'Player') as name,
      p.seed,
      p.created_at
    FROM public.bracket_participants p
    WHERE EXISTS (SELECT 1 FROM public.bracket_tournaments t WHERE t.id = p.competition_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Update bracket_matches to use correct foreign key references
DO $$
BEGIN
  -- If bracket_matches exists, update it to reference the new tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bracket_matches' AND table_schema = 'public') THEN

    -- Add tournament_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bracket_matches' AND column_name = 'tournament_id') THEN
      ALTER TABLE public.bracket_matches ADD COLUMN tournament_id UUID;
    END IF;

    -- Migrate competition_id to tournament_id if competition_id exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bracket_matches' AND column_name = 'competition_id') THEN
      UPDATE public.bracket_matches
      SET tournament_id = competition_id
      WHERE tournament_id IS NULL AND competition_id IS NOT NULL;
    END IF;

    -- Remove duplicate winner columns - keep only winner_participant_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bracket_matches' AND column_name = 'winner_id') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bracket_matches' AND column_name = 'winner_participant_id') THEN
      -- Copy winner_id to winner_participant_id if winner_participant_id is null
      UPDATE public.bracket_matches
      SET winner_participant_id = winner_id
      WHERE winner_participant_id IS NULL AND winner_id IS NOT NULL;

      -- Drop winner_id column
      ALTER TABLE public.bracket_matches DROP COLUMN IF EXISTS winner_id;
    END IF;

    -- Ensure tournament_id is not null and has foreign key constraint
    UPDATE public.bracket_matches SET tournament_id = gen_random_uuid() WHERE tournament_id IS NULL;
    ALTER TABLE public.bracket_matches ALTER COLUMN tournament_id SET NOT NULL;

    -- Drop old foreign key constraints
    ALTER TABLE public.bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_competition_id_fkey;
    ALTER TABLE public.bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_tournament_id_fkey;

    -- Add new foreign key constraint
    ALTER TABLE public.bracket_matches
    ADD CONSTRAINT bracket_matches_tournament_id_fkey
    FOREIGN KEY (tournament_id) REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE;

    -- Drop competition_id column if it exists
    ALTER TABLE public.bracket_matches DROP COLUMN IF EXISTS competition_id;

  ELSE
    -- Create bracket_matches table if it doesn't exist
    CREATE TABLE public.bracket_matches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id UUID NOT NULL REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE,
      round INTEGER NOT NULL CHECK (round >= 1),
      position INTEGER NOT NULL CHECK (position >= 1),
      participant1_id UUID NULL REFERENCES public.bracket_players(id) ON DELETE SET NULL,
      participant2_id UUID NULL REFERENCES public.bracket_players(id) ON DELETE SET NULL,
      winner_participant_id UUID NULL REFERENCES public.bracket_players(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
      reported_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
      reported_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tournament_id, round, position)
    );
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bracket_tournaments_created_by ON public.bracket_tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_bracket_tournaments_status ON public.bracket_tournaments(status);
CREATE INDEX IF NOT EXISTS idx_bracket_tournaments_public ON public.bracket_tournaments(is_public);
CREATE INDEX IF NOT EXISTS idx_bracket_players_tournament ON public.bracket_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_bracket_players_user ON public.bracket_players(user_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_tournament ON public.bracket_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_round ON public.bracket_matches(tournament_id, round);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_participants ON public.bracket_matches(participant1_id, participant2_id);

-- Create or update trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS tr_bracket_tournaments_updated ON public.bracket_tournaments;
CREATE TRIGGER tr_bracket_tournaments_updated
BEFORE UPDATE ON public.bracket_tournaments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_bracket_matches_updated ON public.bracket_matches;
CREATE TRIGGER tr_bracket_matches_updated
BEFORE UPDATE ON public.bracket_matches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.bracket_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_matches ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies
-- Bracket Tournaments
DROP POLICY IF EXISTS bracket_tournaments_select ON public.bracket_tournaments;
CREATE POLICY bracket_tournaments_select ON public.bracket_tournaments
  FOR SELECT USING (is_public OR auth.uid() = created_by);

DROP POLICY IF EXISTS bracket_tournaments_insert ON public.bracket_tournaments;
CREATE POLICY bracket_tournaments_insert ON public.bracket_tournaments
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS bracket_tournaments_update ON public.bracket_tournaments;
CREATE POLICY bracket_tournaments_update ON public.bracket_tournaments
  FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS bracket_tournaments_delete ON public.bracket_tournaments;
CREATE POLICY bracket_tournaments_delete ON public.bracket_tournaments
  FOR DELETE USING (auth.uid() = created_by);

-- Bracket Players
DROP POLICY IF EXISTS bracket_players_select ON public.bracket_players;
CREATE POLICY bracket_players_select ON public.bracket_players
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t
           WHERE t.id = tournament_id AND (t.is_public OR t.created_by = auth.uid()))
  );

DROP POLICY IF EXISTS bracket_players_mutate ON public.bracket_players;
CREATE POLICY bracket_players_mutate ON public.bracket_players
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t
           WHERE t.id = tournament_id AND t.created_by = auth.uid())
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t
           WHERE t.id = tournament_id AND t.created_by = auth.uid())
  );

-- Bracket Matches
DROP POLICY IF EXISTS bracket_matches_select ON public.bracket_matches;
CREATE POLICY bracket_matches_select ON public.bracket_matches
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t
           WHERE t.id = tournament_id AND (t.is_public OR t.created_by = auth.uid()))
  );

DROP POLICY IF EXISTS bracket_matches_mutate ON public.bracket_matches;
CREATE POLICY bracket_matches_mutate ON public.bracket_matches
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t
           WHERE t.id = tournament_id AND t.created_by = auth.uid())
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t
           WHERE t.id = tournament_id AND t.created_by = auth.uid())
  );

-- Clean up old tables if they exist and data has been migrated
DO $$
BEGIN
  -- Only drop old tables if new tables have data
  IF EXISTS (SELECT 1 FROM public.bracket_tournaments LIMIT 1) AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bracket_competitions') THEN
    DROP TABLE IF EXISTS public.bracket_competitions CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.bracket_players LIMIT 1) AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bracket_participants') THEN
    DROP TABLE IF EXISTS public.bracket_participants CASCADE;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON TABLE public.bracket_tournaments IS 'Tournament bracket competitions with support for single and double elimination';
COMMENT ON TABLE public.bracket_players IS 'Players/participants in bracket tournaments';
COMMENT ON TABLE public.bracket_matches IS 'Individual matches within bracket tournaments with winner tracking';
COMMENT ON COLUMN public.bracket_tournaments.bracket_type IS 'Type of elimination: single or double';
COMMENT ON COLUMN public.bracket_matches.round IS 'Round number: 1+ for winners bracket, 100+ for losers bracket, 1000+ for grand finals';