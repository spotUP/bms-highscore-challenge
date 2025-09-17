-- Clear problematic placeholder URLs that cause DNS errors
UPDATE games_database
SET screenshot_url = NULL
WHERE screenshot_url LIKE '%via.placeholder.com%';

-- Drop the placeholder function that creates problematic URLs
DROP FUNCTION IF EXISTS generate_placeholder_image_url(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_placeholder_images();