-- Create comprehensive games database from LaunchBox data

-- Platforms table
CREATE TABLE IF NOT EXISTS platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emulated BOOLEAN DEFAULT false,
  release_date DATE,
  developer TEXT,
  manufacturer TEXT,
  cpu TEXT,
  memory TEXT,
  graphics TEXT,
  sound TEXT,
  display TEXT,
  media TEXT,
  max_controllers TEXT,
  notes TEXT,
  category TEXT,
  use_mame_files BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games table with comprehensive metadata
CREATE TABLE IF NOT EXISTS games_database (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform_id UUID REFERENCES platforms(id),
  platform_name TEXT NOT NULL, -- Denormalized for easier queries
  database_id INTEGER UNIQUE, -- Original LaunchBox database ID
  release_year INTEGER,
  overview TEXT,
  max_players INTEGER,
  release_type TEXT,
  cooperative BOOLEAN,
  video_url TEXT,
  community_rating DECIMAL(4,2),
  community_rating_count INTEGER,
  esrb_rating TEXT,
  genres TEXT[], -- Array of genres
  developer TEXT,
  publisher TEXT,
  series TEXT,
  region TEXT,
  alternative_names TEXT[],
  play_modes TEXT[], -- Single-player, Multiplayer, etc.
  themes TEXT[], -- Horror, Sci-Fi, etc.
  wikipedia_url TEXT,
  video_urls TEXT[], -- Multiple video URLs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_games_database_name ON games_database(name);
CREATE INDEX IF NOT EXISTS idx_games_database_platform ON games_database(platform_name);
CREATE INDEX IF NOT EXISTS idx_games_database_release_year ON games_database(release_year);
CREATE INDEX IF NOT EXISTS idx_games_database_rating ON games_database(community_rating);
CREATE INDEX IF NOT EXISTS idx_games_database_genres ON games_database USING GIN(genres);
CREATE INDEX IF NOT EXISTS idx_games_database_developer ON games_database(developer);
CREATE INDEX IF NOT EXISTS idx_games_database_publisher ON games_database(publisher);
CREATE INDEX IF NOT EXISTS idx_games_database_themes ON games_database USING GIN(themes);
CREATE INDEX IF NOT EXISTS idx_games_database_play_modes ON games_database USING GIN(play_modes);

-- Game selection criteria table for competitions
CREATE TABLE IF NOT EXISTS game_selection_criteria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  criteria JSONB NOT NULL, -- Flexible criteria storage
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_selection_criteria ENABLE ROW LEVEL SECURITY;

-- Everyone can read games and platforms
CREATE POLICY "games_database_select" ON games_database FOR SELECT USING (true);
CREATE POLICY "platforms_select" ON platforms FOR SELECT USING (true);
CREATE POLICY "game_selection_criteria_select" ON game_selection_criteria FOR SELECT USING (true);

-- Only authenticated users can create/update criteria
CREATE POLICY "game_selection_criteria_insert" ON game_selection_criteria
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "game_selection_criteria_update" ON game_selection_criteria
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_platforms_updated_at BEFORE UPDATE ON platforms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_database_updated_at BEFORE UPDATE ON games_database
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_selection_criteria_updated_at BEFORE UPDATE ON game_selection_criteria
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample selection criteria
INSERT INTO game_selection_criteria (name, description, criteria) VALUES
  ('Arcade Classics', 'Classic arcade games from the 80s and 90s',
   '{"platforms": ["Arcade"], "release_year_min": 1980, "release_year_max": 1999, "genres": ["Action"]}'),
  ('Multiplayer Games', 'Games that support multiple players',
   '{"max_players_min": 2, "play_modes": ["Multiplayer"]}'),
  ('Highly Rated', 'Games with community rating above 4.0',
   '{"community_rating_min": 4.0, "community_rating_count_min": 10}'),
  ('Retro Consoles', 'Games from classic console systems',
   '{"platforms": ["Nintendo Entertainment System", "Super Nintendo Entertainment System", "Sega Genesis", "Nintendo 64", "PlayStation"]}');