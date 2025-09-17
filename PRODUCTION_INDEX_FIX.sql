-- URGENT: Run these SQL commands in Supabase SQL Editor to fix production search timeouts
-- Go to: Supabase Dashboard -> SQL Editor -> New Query -> Paste and Run

-- 1. Create a basic index for name prefix searches (MOST IMPORTANT)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_database_name_prefix
ON games_database (name text_pattern_ops);

-- 2. Create a case-insensitive index for better ILIKE performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_database_name_lower
ON games_database (LOWER(name) text_pattern_ops);

-- 3. Create platform filter index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_database_platform
ON games_database (platform_name);

-- 4. Check if indexes were created successfully
SELECT
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE tablename = 'games_database'
    AND indexname LIKE 'idx_games%';

-- 5. Test search performance after indexes
EXPLAIN ANALYZE
SELECT name, platform_name, release_year
FROM games_database
WHERE name ILIKE 'mario%'
LIMIT 8;