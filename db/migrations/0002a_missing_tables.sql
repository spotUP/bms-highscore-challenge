-- Tables that were previously created by supabase/migrations/ and are
-- referenced by the frontend but were never consolidated into db/migrations/.

----------------------------------------------------------------
-- platforms
----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platforms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  emulated boolean DEFAULT false,
  release_date date,
  developer text,
  manufacturer text,
  cpu text,
  memory text,
  graphics text,
  sound text,
  display text,
  media text,
  max_controllers text,
  notes text,
  category text,
  use_mame_files boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER update_platforms_updated_at
  BEFORE UPDATE ON platforms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

----------------------------------------------------------------
-- games_database  (LaunchBox game catalog)
----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games_database (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  platform_id uuid REFERENCES platforms(id),
  platform_name text NOT NULL,
  database_id integer,
  release_year integer,
  overview text,
  max_players integer,
  release_type text,
  release_date text,
  cooperative boolean,
  video_url text,
  community_rating numeric(5,2),
  community_rating_count integer,
  esrb_rating text,
  genres text[],
  developer text,
  publisher text,
  series text,
  region text,
  alternative_names text[],
  play_modes text[],
  themes text[],
  wikipedia_url text,
  video_urls text[],
  screenshot_url text,
  cover_url text,
  logo_url text,
  banner_url text,
  fanart_url text,
  clearlogo_url text,
  search_vector tsvector,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_database_name ON games_database(name);
CREATE INDEX IF NOT EXISTS idx_games_database_platform ON games_database(platform_name);
CREATE INDEX IF NOT EXISTS idx_games_database_release_year ON games_database(release_year);
CREATE INDEX IF NOT EXISTS idx_games_database_rating ON games_database(community_rating);
CREATE INDEX IF NOT EXISTS idx_games_database_genres ON games_database USING GIN(genres);
CREATE INDEX IF NOT EXISTS idx_games_database_developer ON games_database(developer);
CREATE INDEX IF NOT EXISTS idx_games_database_publisher ON games_database(publisher);
CREATE INDEX IF NOT EXISTS idx_games_database_themes ON games_database USING GIN(themes);
CREATE INDEX IF NOT EXISTS idx_games_database_play_modes ON games_database USING GIN(play_modes);
CREATE INDEX IF NOT EXISTS idx_games_database_screenshot ON games_database(screenshot_url) WHERE screenshot_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_database_cover ON games_database(cover_url) WHERE cover_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_database_video_url ON games_database(video_url);
CREATE INDEX IF NOT EXISTS idx_games_database_esrb_rating ON games_database(esrb_rating);
CREATE INDEX IF NOT EXISTS idx_games_database_community_rating ON games_database(community_rating);
CREATE INDEX IF NOT EXISTS idx_games_database_search_vector ON games_database USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_games_database_name_lower ON games_database(lower(name));

CREATE TRIGGER update_games_database_updated_at
  BEFORE UPDATE ON games_database
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Full-text search vector generation
CREATE OR REPLACE FUNCTION generate_game_search_vector(game_name text)
RETURNS tsvector AS $$
DECLARE
  search_variations text[];
  final_text text;
BEGIN
  search_variations := ARRAY[
    game_name,
    regexp_replace(game_name, '\s+', '-', 'g'),
    regexp_replace(game_name, '\s+', '', 'g'),
    regexp_replace(game_name, '-', ' ', 'g'),
    regexp_replace(game_name, '[^\w\s]', '', 'g'),
    regexp_replace(game_name, '\s+n\s+', ' ''n ', 'gi'),
    regexp_replace(game_name, '\s+n\s+', '''n ', 'gi'),
    regexp_replace(game_name, '\s+''n\s+', ' n ', 'gi'),
    regexp_replace(game_name, '\s+and\s+', ' ''n ', 'gi'),
    regexp_replace(game_name, '\s+and\s+', '''n ', 'gi')
  ];
  final_text := array_to_string(search_variations, ' ');
  RETURN to_tsvector('simple', final_text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION update_game_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector = generate_game_search_vector(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_games_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name ON games_database
  FOR EACH ROW EXECUTE FUNCTION update_game_search_vector();

----------------------------------------------------------------
-- bracket_tournaments
----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bracket_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bracket_type text DEFAULT 'single',
  is_public boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_bracket_tournaments_updated_at
  BEFORE UPDATE ON bracket_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

----------------------------------------------------------------
-- bracket_players
----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bracket_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES bracket_tournaments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  seed integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

----------------------------------------------------------------
-- bracket_matches
----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bracket_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES bracket_tournaments(id) ON DELETE CASCADE,
  round integer NOT NULL CHECK (round >= 1),
  position integer NOT NULL CHECK (position >= 1),
  participant1_id uuid REFERENCES bracket_players(id) ON DELETE SET NULL,
  participant2_id uuid REFERENCES bracket_players(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES bracket_players(id) ON DELETE SET NULL,
  winner_participant_id uuid REFERENCES bracket_players(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round, position)
);

CREATE TRIGGER update_bracket_matches_updated_at
  BEFORE UPDATE ON bracket_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

----------------------------------------------------------------
-- user_favorites
----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_id integer NOT NULL,
  game_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_game_id ON user_favorites(game_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_game ON user_favorites(user_id, game_id);
