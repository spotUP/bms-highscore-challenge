-- SIMPLE FIX FOR ACHIEVEMENTS - Run this in Supabase SQL Editor
-- This will award achievements to players who have scores but no achievements

-- Step 1: Award "First Score" achievement to all players (based on achievement name)
INSERT INTO player_achievements (player_name, achievement_id, tournament_id, earned_at)
SELECT DISTINCT
  s.player_name,
  a.id as achievement_id,
  s.tournament_id,
  MIN(s.created_at) as earned_at
FROM scores s
INNER JOIN achievements a ON a.tournament_id = s.tournament_id
  AND (a.name ILIKE '%first%score%' OR a.name ILIKE '%first%')
LEFT JOIN player_achievements pa ON pa.player_name = s.player_name
  AND pa.achievement_id = a.id
  AND pa.tournament_id = s.tournament_id
WHERE pa.id IS NULL  -- Only for players who don't have this achievement yet
GROUP BY s.player_name, a.id, s.tournament_id;

-- Step 2: Award achievements for high scores (100+ points)
INSERT INTO player_achievements (player_name, achievement_id, tournament_id, earned_at)
SELECT DISTINCT
  s.player_name,
  a.id as achievement_id,
  s.tournament_id,
  MIN(s.created_at) as earned_at
FROM scores s
INNER JOIN achievements a ON a.tournament_id = s.tournament_id
  AND (a.name ILIKE '%century%' OR a.name ILIKE '%100%' OR a.name ILIKE '%milestone%')
LEFT JOIN player_achievements pa ON pa.player_name = s.player_name
  AND pa.achievement_id = a.id
  AND pa.tournament_id = s.tournament_id
WHERE pa.id IS NULL  -- Only for players who don't have this achievement yet
  AND s.score >= 100
GROUP BY s.player_name, a.id, s.tournament_id;

-- Step 3: Award achievements for really high scores (1000+ points)
INSERT INTO player_achievements (player_name, achievement_id, tournament_id, earned_at)
SELECT DISTINCT
  s.player_name,
  a.id as achievement_id,
  s.tournament_id,
  MIN(s.created_at) as earned_at
FROM scores s
INNER JOIN achievements a ON a.tournament_id = s.tournament_id
  AND (a.name ILIKE '%thousand%' OR a.name ILIKE '%1000%' OR a.name ILIKE '%elite%' OR a.name ILIKE '%master%')
LEFT JOIN player_achievements pa ON pa.player_name = s.player_name
  AND pa.achievement_id = a.id
  AND pa.tournament_id = s.tournament_id
WHERE pa.id IS NULL  -- Only for players who don't have this achievement yet
  AND s.score >= 1000
GROUP BY s.player_name, a.id, s.tournament_id;

-- Step 4: Award achievements to top scorers in each game
INSERT INTO player_achievements (player_name, achievement_id, tournament_id, earned_at)
SELECT DISTINCT
  ranked_scores.player_name,
  a.id as achievement_id,
  ranked_scores.tournament_id,
  ranked_scores.created_at as earned_at
FROM (
  SELECT
    player_name,
    game_id,
    tournament_id,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY game_id, tournament_id ORDER BY score DESC) as rank
  FROM scores
) ranked_scores
INNER JOIN achievements a ON a.tournament_id = ranked_scores.tournament_id
  AND (a.name ILIKE '%first%place%' OR a.name ILIKE '%champion%' OR a.name ILIKE '%winner%' OR a.name ILIKE '%leader%')
LEFT JOIN player_achievements pa ON pa.player_name = ranked_scores.player_name
  AND pa.achievement_id = a.id
  AND pa.tournament_id = ranked_scores.tournament_id
WHERE pa.id IS NULL  -- Only for players who don't have this achievement yet
  AND ranked_scores.rank = 1;  -- Only first place

-- Step 5: Check what we've created
SELECT
  'Total Player Achievements Created' as metric,
  COUNT(*) as count
FROM player_achievements
UNION ALL
SELECT
  'Unique Players with Achievements' as metric,
  COUNT(DISTINCT player_name) as count
FROM player_achievements
UNION ALL
SELECT
  'Achievements by Player' as metric,
  NULL as count
FROM player_achievements
LIMIT 1;

-- Show achievements by player
SELECT
  pa.player_name,
  COUNT(*) as achievement_count,
  STRING_AGG(a.name, ', ') as achievements
FROM player_achievements pa
JOIN achievements a ON a.id = pa.achievement_id
GROUP BY pa.player_name
ORDER BY achievement_count DESC;