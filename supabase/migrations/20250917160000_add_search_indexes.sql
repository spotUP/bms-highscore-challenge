-- Add indexes to improve search performance on games_database table

-- Index for name search (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_games_database_name_lower
ON games_database (LOWER(name));

-- Index for platform filtering
CREATE INDEX IF NOT EXISTS idx_games_database_platform_name
ON games_database (platform_name);

-- Index for release year filtering
CREATE INDEX IF NOT EXISTS idx_games_database_release_year
ON games_database (release_year);

-- Composite index for common filters
CREATE INDEX IF NOT EXISTS idx_games_database_platform_year
ON games_database (platform_name, release_year);