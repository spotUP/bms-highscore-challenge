-- Fix player name length constraint to allow up to 16 characters
-- This resolves the issue where score submission fails for names longer than 3 characters

-- Drop the existing restrictive constraint that only allowed very short names
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check;

-- Add new constraint allowing 1-16 characters and ensuring name is not empty/whitespace
ALTER TABLE scores ADD CONSTRAINT scores_player_name_check
  CHECK (
    length(trim(player_name)) >= 1
    AND length(trim(player_name)) <= 16
    AND trim(player_name) != ''
  );

-- Ensure the column can handle this length (update column type if needed)
ALTER TABLE scores ALTER COLUMN player_name TYPE VARCHAR(16);