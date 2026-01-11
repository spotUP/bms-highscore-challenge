-- Add image support to games database

-- Add image columns to games_database table
ALTER TABLE games_database
ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS cover_url TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS fanart_url TEXT,
ADD COLUMN IF NOT EXISTS clearlogo_url TEXT;

-- Create indexes for image URLs (for cleanup/maintenance queries)
CREATE INDEX IF NOT EXISTS idx_games_database_screenshot ON games_database(screenshot_url) WHERE screenshot_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_database_cover ON games_database(cover_url) WHERE cover_url IS NOT NULL;

-- Add image preferences to game selection criteria
ALTER TABLE game_selection_criteria
ADD COLUMN IF NOT EXISTS require_images BOOLEAN DEFAULT false;

-- Sample image-based criteria
INSERT INTO game_selection_criteria (name, description, criteria) VALUES
  ('Games with Screenshots', 'Games that have screenshot images available',
   '{"require_images": true, "community_rating_min": 3.0}')
ON CONFLICT (name) DO NOTHING;

-- Function to generate placeholder image URLs based on game name and platform
CREATE OR REPLACE FUNCTION generate_placeholder_image_url(game_name TEXT, platform_name TEXT, image_type TEXT DEFAULT 'screenshot')
RETURNS TEXT AS $$
BEGIN
  -- For now, return a placeholder URL that could be replaced with actual service later
  RETURN CONCAT(
    'https://via.placeholder.com/300x200/1a1a1a/ffffff?text=',
    encode(CONCAT(game_name, ' (', platform_name, ')'), 'base64')
  );
END;
$$ LANGUAGE plpgsql;

-- Function to update games with placeholder images where none exist
CREATE OR REPLACE FUNCTION update_placeholder_images()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Update games that don't have screenshot URLs
  UPDATE games_database
  SET screenshot_url = generate_placeholder_image_url(name, platform_name, 'screenshot')
  WHERE screenshot_url IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Comment: To populate placeholder images, run: SELECT update_placeholder_images();