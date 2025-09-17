-- Add start_time and end_time columns to tournaments table
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;

-- Add an index on start_time and end_time for better query performance
CREATE INDEX IF NOT EXISTS idx_tournaments_start_time ON public.tournaments(start_time);
CREATE INDEX IF NOT EXISTS idx_tournaments_end_time ON public.tournaments(end_time);

-- Add a check constraint to ensure end_time is after start_time when both are set
ALTER TABLE public.tournaments
ADD CONSTRAINT chk_tournament_times CHECK (
  (start_time IS NULL OR end_time IS NULL) OR (end_time > start_time)
);