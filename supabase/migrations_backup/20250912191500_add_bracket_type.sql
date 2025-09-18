-- Add bracket_type to bracket_competitions (default 'single')
ALTER TABLE public.bracket_competitions
ADD COLUMN IF NOT EXISTS bracket_type text NOT NULL DEFAULT 'single' CHECK (bracket_type IN ('single','double'));

COMMENT ON COLUMN public.bracket_competitions.bracket_type IS 'Type of bracket: single or double elimination (default single).';
