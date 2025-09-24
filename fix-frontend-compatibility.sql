-- Add missing columns that the frontend expects
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS logo_base64 TEXT;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS launchbox_id INTEGER;

-- Update launchbox_id to match database_id since that's the LaunchBox ID
UPDATE games_database SET launchbox_id = database_id WHERE launchbox_id IS NULL;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_random_games(integer);

-- Create get_random_games function that the frontend expects
CREATE OR REPLACE FUNCTION get_random_games(game_count integer DEFAULT 10)
RETURNS TABLE (
  id bigint,
  name text,
  platform_name text,
  database_id integer,
  release_year integer,
  overview text,
  max_players integer,
  cooperative boolean,
  community_rating decimal(10,8),
  community_rating_count integer,
  esrb_rating text,
  genres text[],
  developer text,
  publisher text,
  video_url text,
  screenshot_url text,
  cover_url text,
  logo_url text,
  logo_base64 text,
  launchbox_id integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.name, g.platform_name, g.database_id, g.release_year, g.overview,
         g.max_players, g.cooperative, g.community_rating, g.community_rating_count,
         g.esrb_rating, g.genres, g.developer, g.publisher, g.video_url, g.screenshot_url,
         g.cover_url, g.logo_url, g.logo_base64, g.launchbox_id, g.created_at, g.updated_at
  FROM games_database g
  ORDER BY RANDOM()
  LIMIT game_count;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS if not already enabled
ALTER TABLE games_database ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'games_database'
        AND policyname = 'Allow public read access to games_database'
    ) THEN
        CREATE POLICY "Allow public read access to games_database"
        ON games_database FOR SELECT
        TO public
        USING (true);
    END IF;
END
$$;