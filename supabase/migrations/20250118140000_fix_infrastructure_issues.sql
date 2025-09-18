-- Fix infrastructure issues identified in deploy tests

-- Ensure scores table has user_id column
ALTER TABLE scores ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);

-- Ensure tournaments table has status column
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','completed'));

-- Ensure bracket_tournaments table exists
CREATE TABLE IF NOT EXISTS bracket_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bracket_type TEXT DEFAULT 'single',
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure bracket_players table exists
CREATE TABLE IF NOT EXISTS bracket_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES bracket_tournaments(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  seed INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure bracket_matches table exists
CREATE TABLE IF NOT EXISTS bracket_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES bracket_tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL CHECK (round >= 1),
  position INTEGER NOT NULL CHECK (position >= 1),
  participant1_id UUID NULL REFERENCES bracket_players(id) ON DELETE SET NULL,
  participant2_id UUID NULL REFERENCES bracket_players(id) ON DELETE SET NULL,
  winner_id UUID NULL REFERENCES bracket_players(id) ON DELETE SET NULL,
  winner_participant_id UUID NULL REFERENCES bracket_players(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  reported_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, round, position)
);

-- Enable RLS on bracket tables
ALTER TABLE bracket_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bracket tables
CREATE POLICY "bracket_tournaments_select" ON bracket_tournaments FOR SELECT USING (is_public = true OR auth.uid() = created_by);
CREATE POLICY "bracket_tournaments_insert" ON bracket_tournaments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "bracket_tournaments_update" ON bracket_tournaments FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "bracket_tournaments_delete" ON bracket_tournaments FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "bracket_players_select" ON bracket_players FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bracket_tournaments bt
    WHERE bt.id = tournament_id
    AND (bt.is_public = true OR bt.created_by = auth.uid())
  )
);
CREATE POLICY "bracket_players_insert" ON bracket_players FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM bracket_tournaments bt
    WHERE bt.id = tournament_id
    AND bt.created_by = auth.uid()
  )
);
CREATE POLICY "bracket_players_update" ON bracket_players FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM bracket_tournaments bt
    WHERE bt.id = tournament_id
    AND bt.created_by = auth.uid()
  )
);
CREATE POLICY "bracket_players_delete" ON bracket_players FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM bracket_tournaments bt
    WHERE bt.id = tournament_id
    AND bt.created_by = auth.uid()
  )
);

CREATE POLICY "bracket_matches_select" ON bracket_matches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bracket_tournaments bt
    WHERE bt.id = tournament_id
    AND (bt.is_public = true OR bt.created_by = auth.uid())
  )
);
CREATE POLICY "bracket_matches_insert" ON bracket_matches FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM bracket_tournaments bt
    WHERE bt.id = tournament_id
    AND bt.created_by = auth.uid()
  )
);
CREATE POLICY "bracket_matches_update" ON bracket_matches FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM bracket_tournaments bt
    WHERE bt.id = tournament_id
    AND bt.created_by = auth.uid()
  )
);
CREATE POLICY "bracket_matches_delete" ON bracket_matches FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM bracket_tournaments bt
    WHERE bt.id = tournament_id
    AND bt.created_by = auth.uid()
  )
);

-- Add trigger for bracket tournament updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bracket_tournaments_updated_at BEFORE UPDATE ON bracket_tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bracket_matches_updated_at BEFORE UPDATE ON bracket_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();