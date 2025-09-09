-- Comprehensive verification of joust scores, users, and tournament connections

-- 1. Check the current tournament and joust game setup
SELECT 
  'CURRENT TOURNAMENT & JOUST GAME' as section,
  t.id as tournament_id,
  t.name as tournament_name,
  g.id as joust_game_id,
  g.name as joust_game_name,
  g.is_active as joust_game_active,
  g.include_in_challenge as joust_in_challenge
FROM tournaments t
CROSS JOIN games g
WHERE g.name ILIKE '%joust%';

-- 2. Check all joust scores and their tournament associations
SELECT 
  'JOUST SCORES BREAKDOWN' as section,
  s.id as score_id,
  s.player_name,
  s.score,
  s.tournament_id as score_tournament_id,
  s.game_id as score_game_id,
  s.created_at,
  g.name as game_name,
  g.tournament_id as game_tournament_id,
  t.name as score_tournament_name,
  gt.name as game_tournament_name,
  CASE 
    WHEN s.tournament_id = g.tournament_id THEN 'MATCH ✓'
    ELSE 'MISMATCH ✗'
  END as tournament_match_status
FROM scores s
JOIN games g ON s.game_id = g.id
LEFT JOIN tournaments t ON s.tournament_id = t.id
LEFT JOIN tournaments gt ON g.tournament_id = gt.id
WHERE g.name ILIKE '%joust%'
ORDER BY s.score DESC;

-- 3. Check if there are multiple joust games in different tournaments
SELECT 
  'MULTIPLE JOUST GAMES CHECK' as section,
  g.id,
  g.name,
  g.tournament_id,
  t.name as tournament_name,
  g.is_active,
  g.include_in_challenge,
  COUNT(s.id) as score_count
FROM games g
LEFT JOIN tournaments t ON g.tournament_id = t.id
LEFT JOIN scores s ON g.id = s.game_id
WHERE g.name ILIKE '%joust%'
GROUP BY g.id, g.name, g.tournament_id, t.name, g.is_active, g.include_in_challenge;

-- 4. Check player names in joust scores
SELECT 
  'PLAYER NAMES CHECK' as section,
  s.player_name,
  s.score,
  s.created_at,
  'Player name exists in scores' as status
FROM scores s
WHERE s.game_id IN (SELECT id FROM games WHERE name ILIKE '%joust%')
ORDER BY s.score DESC;

-- 5. Fix any mismatched tournament IDs for joust scores
UPDATE scores 
SET tournament_id = (
  SELECT g.tournament_id 
  FROM games g 
  WHERE g.id = scores.game_id 
    AND g.name ILIKE '%joust%'
)
WHERE game_id IN (
  SELECT id 
  FROM games 
  WHERE name ILIKE '%joust%'
)
AND tournament_id != (
  SELECT g.tournament_id 
  FROM games g 
  WHERE g.id = scores.game_id 
    AND g.name ILIKE '%joust%'
);

-- 6. Final verification after fix
SELECT 
  'FINAL VERIFICATION' as section,
  s.id as score_id,
  s.player_name,
  s.score,
  s.tournament_id as score_tournament_id,
  g.tournament_id as game_tournament_id,
  t.name as tournament_name,
  CASE 
    WHEN s.tournament_id = g.tournament_id THEN 'ALL GOOD ✓'
    ELSE 'STILL MISMATCHED ✗'
  END as final_status
FROM scores s
JOIN games g ON s.game_id = g.id
JOIN tournaments t ON s.tournament_id = t.id
WHERE g.name ILIKE '%joust%'
ORDER BY s.score DESC;
