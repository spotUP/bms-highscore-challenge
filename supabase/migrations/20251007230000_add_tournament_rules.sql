-- Add tournament-specific rules storage
-- Each tournament can have its own customized rules based on the global rules template

ALTER TABLE public.tournaments
ADD COLUMN rules_data JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tournaments.rules_data IS 'Custom rules configuration for this tournament, stored as JSON';