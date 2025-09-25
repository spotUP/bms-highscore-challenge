-- QUICK FIX FOR ACHIEVEMENT SYSTEM
-- Run this in Supabase SQL Editor to fix achievements

-- Step 1: Manually award "First Score" achievements to players who have scores but no achievements
INSERT INTO player_achievements (player_name, achievement_id, tournament_id, earned_at)
SELECT DISTINCT
  s.player_name,
  a.id as achievement_id,
  s.tournament_id,
  MIN(s.created_at) as earned_at
FROM scores s
INNER JOIN achievements a ON a.tournament_id = s.tournament_id AND a.type = 'first_score'
LEFT JOIN player_achievements pa ON pa.player_name = s.player_name
  AND pa.achievement_id = a.id
  AND pa.tournament_id = s.tournament_id
WHERE pa.id IS NULL  -- Only for players who don't have this achievement yet
  AND a.is_active = true
GROUP BY s.player_name, a.id, s.tournament_id;

-- Step 2: Award score milestone achievements (100+ points)
INSERT INTO player_achievements (player_name, achievement_id, tournament_id, earned_at)
SELECT DISTINCT
  s.player_name,
  a.id as achievement_id,
  s.tournament_id,
  MIN(s.created_at) as earned_at
FROM scores s
INNER JOIN achievements a ON a.tournament_id = s.tournament_id
  AND a.type = 'score_milestone'
  AND s.score >= COALESCE((a.criteria->>'threshold')::int, 100)
LEFT JOIN player_achievements pa ON pa.player_name = s.player_name
  AND pa.achievement_id = a.id
  AND pa.tournament_id = s.tournament_id
WHERE pa.id IS NULL  -- Only for players who don't have this achievement yet
  AND a.is_active = true
GROUP BY s.player_name, a.id, s.tournament_id;

-- Step 3: Award first place achievements
INSERT INTO player_achievements (player_name, achievement_id, tournament_id, earned_at)
SELECT DISTINCT
  s.player_name,
  a.id as achievement_id,
  s.tournament_id,
  s.created_at as earned_at
FROM (
  -- Find all first place scores
  SELECT DISTINCT ON (game_id, tournament_id)
    player_name,
    game_id,
    tournament_id,
    created_at
  FROM scores
  ORDER BY game_id, tournament_id, score DESC, created_at ASC
) s
INNER JOIN achievements a ON a.tournament_id = s.tournament_id
  AND a.type = 'first_place'
LEFT JOIN player_achievements pa ON pa.player_name = s.player_name
  AND pa.achievement_id = a.id
  AND pa.tournament_id = s.tournament_id
WHERE pa.id IS NULL  -- Only for players who don't have this achievement yet
  AND a.is_active = true;

-- Step 4: Check results
SELECT
  'Total Player Achievements' as metric,
  COUNT(*) as count
FROM player_achievements
UNION ALL
SELECT
  'Unique Players with Achievements' as metric,
  COUNT(DISTINCT player_name) as count
FROM player_achievements
UNION ALL
SELECT
  'Players with Scores but No Achievements' as metric,
  COUNT(*) as count
FROM (
  SELECT DISTINCT s.player_name
  FROM scores s
  LEFT JOIN player_achievements pa ON pa.player_name = s.player_name
  WHERE pa.id IS NULL
) t;