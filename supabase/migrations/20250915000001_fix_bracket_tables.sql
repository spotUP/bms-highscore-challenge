-- Fix bracket table names to match what the code expects
-- The existing migration created bracket_competitions/bracket_participants
-- but the code expects bracket_tournaments/bracket_players

-- Create bracket_tournaments table (matches bracket_competitions structure but with expected name)
CREATE TABLE IF NOT EXISTS public.bracket_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create bracket_players table (matches bracket_participants structure but with expected name)
CREATE TABLE IF NOT EXISTS public.bracket_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  seed INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update bracket_matches to reference tournament_id instead of competition_id
-- First, check if the table exists with the old structure and modify it
DO $$
BEGIN
  -- Check if bracket_matches has competition_id column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bracket_matches'
    AND column_name = 'competition_id'
    AND table_schema = 'public'
  ) THEN
    -- Add tournament_id column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'bracket_matches'
      AND column_name = 'tournament_id'
      AND table_schema = 'public'
    ) THEN
      ALTER TABLE public.bracket_matches ADD COLUMN tournament_id UUID;
    END IF;

    -- Copy data from competition_id to tournament_id if there's data
    UPDATE public.bracket_matches
    SET tournament_id = competition_id
    WHERE tournament_id IS NULL AND competition_id IS NOT NULL;

    -- Add foreign key constraint
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'bracket_matches'
      AND constraint_name = 'bracket_matches_tournament_id_fkey'
      AND table_schema = 'public'
    ) THEN
      ALTER TABLE public.bracket_matches
      ADD CONSTRAINT bracket_matches_tournament_id_fkey
      FOREIGN KEY (tournament_id) REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- If bracket_matches doesn't exist, create it with the correct structure
CREATE TABLE IF NOT EXISTS public.bracket_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL CHECK (round >= 1),
  position INTEGER NOT NULL CHECK (position >= 1),
  participant1_id UUID NULL REFERENCES public.bracket_players(id) ON DELETE SET NULL,
  participant2_id UUID NULL REFERENCES public.bracket_players(id) ON DELETE SET NULL,
  winner_id UUID NULL REFERENCES public.bracket_players(id) ON DELETE SET NULL,
  winner_participant_id UUID NULL REFERENCES public.bracket_players(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  reported_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, round, position)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bracket_tournaments_created_by ON public.bracket_tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_bracket_players_tournament ON public.bracket_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_tournament ON public.bracket_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_round ON public.bracket_matches(tournament_id, round);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS tr_bracket_tournaments_updated
BEFORE UPDATE ON public.bracket_tournaments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER IF NOT EXISTS tr_bracket_matches_updated
BEFORE UPDATE ON public.bracket_matches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.bracket_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_matches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bracket_tournaments
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

-- Create RLS policies for bracket_players
DROP POLICY IF EXISTS bracket_players_select ON public.bracket_players;
CREATE POLICY bracket_players_select ON public.bracket_players
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND (t.is_public OR t.created_by = auth.uid()))
  );

DROP POLICY IF EXISTS bracket_players_mutate ON public.bracket_players;
CREATE POLICY bracket_players_mutate ON public.bracket_players
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
  );

-- Create RLS policies for bracket_matches
DROP POLICY IF EXISTS bracket_matches_select ON public.bracket_matches;
CREATE POLICY bracket_matches_select ON public.bracket_matches
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND (t.is_public OR t.created_by = auth.uid()))
  );

DROP POLICY IF EXISTS bracket_matches_mutate ON public.bracket_matches;
CREATE POLICY bracket_matches_mutate ON public.bracket_matches
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.bracket_tournaments t WHERE t.id = tournament_id AND t.created_by = auth.uid())
  );

-- Add comment explaining the fix
COMMENT ON TABLE public.bracket_tournaments IS 'Tournament bracket competitions - fixed table name to match application code expectations';
COMMENT ON TABLE public.bracket_players IS 'Players/participants in bracket tournaments - fixed table name to match application code expectations';
COMMENT ON TABLE public.bracket_matches IS 'Matches within bracket tournaments - updated to use tournament_id consistently';