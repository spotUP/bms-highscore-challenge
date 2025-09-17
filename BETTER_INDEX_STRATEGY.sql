-- BETTER INDEX STRATEGY for ILIKE queries
-- Run these commands ONE AT A TIME in Supabase SQL Editor

-- 1. Create a trigram index (best for ILIKE pattern matching)
-- This requires the pg_trgm extension which should be available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create a GIN index using trigrams for ILIKE queries
CREATE INDEX IF NOT EXISTS idx_games_database_name_gin_trgm
ON games_database USING gin (name gin_trgm_ops);

-- 3. Alternative: Create a functional index on LOWER(name) with trigrams
CREATE INDEX IF NOT EXISTS idx_games_database_name_lower_gin_trgm
ON games_database USING gin (LOWER(name) gin_trgm_ops);

-- 4. Also create a simple btree index as fallback
CREATE INDEX IF NOT EXISTS idx_games_database_name_btree
ON games_database (name);

-- 5. Check if indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'games_database'
    AND indexname LIKE '%name%'
ORDER BY indexname;

-- 6. Test the search again with trigram index
EXPLAIN ANALYZE
SELECT name, platform_name, release_year
FROM games_database
WHERE name ILIKE 'mario%'
LIMIT 8;

-- 7. Force PostgreSQL to use the index (if needed)
SET enable_seqscan = false;
EXPLAIN ANALYZE
SELECT name, platform_name, release_year
FROM games_database
WHERE name ILIKE 'mario%'
LIMIT 8;
SET enable_seqscan = true;