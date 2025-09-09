-- Add demolition_man_active column to tournaments table
-- This controls whether the Demolition Man leaderboard is shown for each tournament

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS demolition_man_active BOOLEAN DEFAULT FALSE;

-- Add comment to explain the column
COMMENT ON COLUMN tournaments.demolition_man_active IS 'Controls whether the Demolition Man leaderboard is displayed for this tournament. Defaults to false for new tournaments.';

-- Update existing tournaments to have the field set to false by default
UPDATE tournaments 
SET demolition_man_active = FALSE 
WHERE demolition_man_active IS NULL;

-- For testing purposes, you can enable it for a specific tournament:
-- UPDATE tournaments SET demolition_man_active = TRUE WHERE slug = 'your-tournament-slug';
