-- Remove is_active and include_in_challenge columns from games table
-- These columns were part of UI switches that have been removed

-- Remove the columns
ALTER TABLE games DROP COLUMN IF EXISTS is_active;
ALTER TABLE games DROP COLUMN IF EXISTS include_in_challenge;

-- Note: All existing games will continue to be shown since we're removing
-- the filtering mechanism entirely. The games query will now show all games
-- for a tournament regardless of their previous is_active status.