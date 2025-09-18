-- Remove the old 3-character constraint and replace with the proper 50-character constraint
-- First, drop the old constraint
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_player_name_check;

-- Add the correct constraint that was already defined but apparently not working
-- Make sure the player_name_length constraint is properly applied
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS player_name_length;

-- Re-add the correct constraint
ALTER TABLE public.scores 
ADD CONSTRAINT player_name_length CHECK (length(trim(player_name)) >= 1 AND length(trim(player_name)) <= 50);