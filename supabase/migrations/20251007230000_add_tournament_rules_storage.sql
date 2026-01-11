-- Add tournament rules storage to tournaments table
-- This allows storing custom rules data for each tournament

ALTER TABLE public.tournaments
ADD COLUMN rules_data JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.tournaments.rules_data IS 'Custom tournament rules and guidelines stored as JSON';