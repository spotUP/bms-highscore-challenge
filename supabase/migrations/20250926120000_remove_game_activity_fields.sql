-- Remove is_active and include_in_challenge columns from games table
-- These fields are no longer needed as all games will be considered active by default

ALTER TABLE games DROP COLUMN IF EXISTS is_active;
ALTER TABLE games DROP COLUMN IF EXISTS include_in_challenge;