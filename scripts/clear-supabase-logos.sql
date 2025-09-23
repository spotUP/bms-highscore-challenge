-- Clear all logo_base64 data from Supabase to free up storage quota
-- This will set logo_base64 to NULL for all games, removing the base64 image data

UPDATE games_database
SET logo_base64 = NULL
WHERE logo_base64 IS NOT NULL;

-- Optional: Check how many rows were affected
-- SELECT COUNT(*) as cleared_logos FROM games_database WHERE logo_base64 IS NULL;