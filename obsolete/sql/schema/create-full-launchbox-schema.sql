-- Create comprehensive LaunchBox games database schema
-- This expands the existing games_database table to support all LaunchBox metadata

-- Add all missing columns to games_database table
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS platform_id UUID REFERENCES platforms(id);
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS database_id INTEGER UNIQUE;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS release_year INTEGER;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS overview TEXT;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS max_players INTEGER;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS release_type TEXT;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS cooperative BOOLEAN;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Rating and community data
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS community_rating DECIMAL(4,2);
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS community_rating_count INTEGER;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS esrb_rating TEXT;

-- Game details
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS genres TEXT[] DEFAULT '{}';
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS developer TEXT;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS publisher TEXT;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS series TEXT;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS region TEXT;

-- Additional metadata
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS alternative_names TEXT[] DEFAULT '{}';
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS play_modes TEXT[] DEFAULT '{}';
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS themes TEXT[] DEFAULT '{}';
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS wikipedia_url TEXT;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS video_urls TEXT[] DEFAULT '{}';

-- Image URLs for better organization
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_database_name ON games_database(name);
CREATE INDEX IF NOT EXISTS idx_games_database_platform ON games_database(platform_name);
CREATE INDEX IF NOT EXISTS idx_games_database_release_year ON games_database(release_year);
CREATE INDEX IF NOT EXISTS idx_games_database_rating ON games_database(community_rating);
CREATE INDEX IF NOT EXISTS idx_games_database_genres ON games_database USING GIN(genres);
CREATE INDEX IF NOT EXISTS idx_games_database_developer ON games_database(developer);
CREATE INDEX IF NOT EXISTS idx_games_database_publisher ON games_database(publisher);
CREATE INDEX IF NOT EXISTS idx_games_database_database_id ON games_database(database_id);
CREATE INDEX IF NOT EXISTS idx_games_database_themes ON games_database USING GIN(themes);
CREATE INDEX IF NOT EXISTS idx_games_database_play_modes ON games_database USING GIN(play_modes);

-- Full-text search index for game names
CREATE INDEX IF NOT EXISTS idx_games_database_name_search
ON games_database USING GIN(to_tsvector('english', name));

-- Compound indexes for common filters
CREATE INDEX IF NOT EXISTS idx_games_database_platform_year
ON games_database(platform_name, release_year);

CREATE INDEX IF NOT EXISTS idx_games_database_rating_count
ON games_database(community_rating, community_rating_count)
WHERE community_rating IS NOT NULL;