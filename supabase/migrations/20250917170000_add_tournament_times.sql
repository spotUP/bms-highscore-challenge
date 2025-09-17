-- Add start_time and end_time columns to tournaments table

ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;

-- Add check constraint to ensure end_time is after start_time
ALTER TABLE public.tournaments
ADD CONSTRAINT check_tournament_times
CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time);