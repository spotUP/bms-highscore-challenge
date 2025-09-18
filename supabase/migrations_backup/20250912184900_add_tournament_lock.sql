-- Add lock support to tournaments (default: unlocked)
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Optional: comment for clarity
COMMENT ON COLUMN public.tournaments.is_locked IS 'If true, the tournament is locked (read-only/admin-controlled). Default false.';
