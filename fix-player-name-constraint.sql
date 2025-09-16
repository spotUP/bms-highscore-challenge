-- Remove the 3-character limit on player names
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check;

-- Add a more reasonable constraint (50 characters max)
ALTER TABLE scores ADD CONSTRAINT scores_player_name_check CHECK (LENGTH(player_name) <= 50 AND LENGTH(player_name) >= 1);