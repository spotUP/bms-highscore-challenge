-- Optimize search performance for games database
-- Add text search capabilities and indexes

-- Add tsvector column for full text search
ALTER TABLE games_database ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to generate search vector from game name and variations
CREATE OR REPLACE FUNCTION generate_game_search_vector(game_name TEXT)
RETURNS tsvector AS $$
DECLARE
  search_variations TEXT[];
  final_text TEXT;
BEGIN
  -- Create search variations to handle common punctuation differences
  search_variations := ARRAY[
    game_name,
    regexp_replace(game_name, '\s+', '-', 'g'), -- spaces to hyphens
    regexp_replace(game_name, '\s+', '', 'g'), -- remove spaces
    regexp_replace(game_name, '-', ' ', 'g'), -- hyphens to spaces
    regexp_replace(game_name, '[^\w\s]', '', 'g'), -- remove punctuation
    regexp_replace(game_name, '\s+n\s+', ' ''n ', 'gi'), -- "n" to "'n"
    regexp_replace(game_name, '\s+n\s+', '''n ', 'gi'), -- "n" to "'n " (arcade format)
    regexp_replace(game_name, '\s+''n\s+', ' n ', 'gi'), -- "'n" to "n"
    regexp_replace(game_name, '\s+and\s+', ' ''n ', 'gi'), -- "and" to "'n"
    regexp_replace(game_name, '\s+and\s+', '''n ', 'gi') -- "and" to "'n " (arcade format)
  ];

  -- Join all variations with spaces
  final_text := array_to_string(search_variations, ' ');

  -- Return tsvector
  RETURN to_tsvector('simple', final_text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing records with search vectors
UPDATE games_database SET search_vector = generate_game_search_vector(name);

-- Create trigger to automatically update search vector on name changes
CREATE OR REPLACE FUNCTION update_game_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = generate_game_search_vector(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_games_search_vector_trigger ON games_database;
CREATE TRIGGER update_games_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name ON games_database
  FOR EACH ROW EXECUTE FUNCTION update_game_search_vector();

-- Create GIN index for fast text search
CREATE INDEX IF NOT EXISTS idx_games_database_search_vector ON games_database USING GIN(search_vector);

-- Create additional index for case-insensitive name search (fallback)
CREATE INDEX IF NOT EXISTS idx_games_database_name_lower ON games_database(lower(name));