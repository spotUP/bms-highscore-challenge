-- Drop existing table to start fresh
DROP TABLE IF EXISTS games_database CASCADE;

-- Create comprehensive table with all fields
CREATE TABLE games_database (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  database_id INTEGER,

  -- Basic metadata
  release_date DATE,
  release_year INTEGER,
  overview TEXT,
  max_players INTEGER,
  cooperative BOOLEAN,

  -- Ratings
  community_rating DECIMAL(10,8),
  community_rating_count INTEGER,
  esrb_rating TEXT,

  -- Media URLs
  video_url TEXT,
  screenshot_url TEXT,
  cover_url TEXT,
  logo_url TEXT,

  -- Extended metadata
  developer TEXT,
  publisher TEXT,
  genres TEXT[], -- Array of strings
  series TEXT,
  region TEXT,
  release_type TEXT,

  -- Additional fields
  wikipedia_url TEXT,
  alternative_names TEXT[], -- Array of strings
  play_modes TEXT[], -- Array of strings
  themes TEXT[], -- Array of strings

  -- Technical fields
  dos BOOLEAN,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_games_database_name ON games_database(name);
CREATE INDEX idx_games_database_platform ON games_database(platform_name);
CREATE INDEX idx_games_database_developer ON games_database(developer);
CREATE INDEX idx_games_database_publisher ON games_database(publisher);
CREATE INDEX idx_games_database_release_year ON games_database(release_year);
CREATE INDEX idx_games_database_genres ON games_database USING GIN(genres);
CREATE INDEX idx_games_database_series ON games_database(series);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_games_database_updated_at
    BEFORE UPDATE ON games_database
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();