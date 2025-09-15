-- URGENT: Fix for "failed to add players" error in bracket system
-- Run this SQL in the Supabase SQL Editor to create the missing bracket_players table

-- Create bracket_players table (the code expects this name)
CREATE TABLE IF NOT EXISTS public.bracket_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.bracket_tournaments(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  seed INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_bracket_players_tournament ON public.bracket_players(tournament_id);

-- Enable RLS
ALTER TABLE public.bracket_players ENABLE ROW LEVEL SECURITY;

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

-- Update bracket_matches foreign key constraints to reference bracket_players instead of bracket_participants
DO $$
BEGIN
  -- Check if participant columns reference the wrong table
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'bracket_matches'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'bracket_participants'
  ) THEN
    -- Drop foreign key constraints that reference bracket_participants
    ALTER TABLE public.bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_participant1_id_fkey;
    ALTER TABLE public.bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_participant2_id_fkey;
    ALTER TABLE public.bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_winner_participant_id_fkey;

    -- Add foreign key constraints that reference bracket_players
    ALTER TABLE public.bracket_matches
    ADD CONSTRAINT bracket_matches_participant1_id_fkey
    FOREIGN KEY (participant1_id) REFERENCES public.bracket_players(id) ON DELETE SET NULL;

    ALTER TABLE public.bracket_matches
    ADD CONSTRAINT bracket_matches_participant2_id_fkey
    FOREIGN KEY (participant2_id) REFERENCES public.bracket_players(id) ON DELETE SET NULL;

    ALTER TABLE public.bracket_matches
    ADD CONSTRAINT bracket_matches_winner_participant_id_fkey
    FOREIGN KEY (winner_participant_id) REFERENCES public.bracket_players(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Verify the fix
SELECT
  'Table created: ' || tablename as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'bracket_players';

-- Show table structure to confirm
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bracket_players'
AND table_schema = 'public'
ORDER BY ordinal_position;