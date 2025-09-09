-- Fix joust scores to match the current tournament
-- This script moves all joust scores to the same tournament as the joust game

-- First, let's see what we're working with
SELECT 
  g.name as game_name,
  g.tournament_id as game_tournament_id,
  COUNT(s.id) as score_count,
  STRING_AGG(DISTINCT s.tournament_id::text, ', ') as score_tournament_ids
FROM games g
LEFT JOIN scores s ON g.id = s.game_id
WHERE g.name ILIKE '%joust%'
GROUP BY g.id, g.name, g.tournament_id;

-- Update all joust scores to match the joust game's tournament
UPDATE scores 
SET tournament_id = (
  SELECT tournament_id 
  FROM games 
  WHERE name ILIKE '%joust%' 
  LIMIT 1
)
WHERE game_id = (
  SELECT id 
  FROM games 
  WHERE name ILIKE '%joust%' 
  LIMIT 1
);

-- Verify the fix
SELECT 
  g.name as game_name,
  g.tournament_id as game_tournament_id,
  COUNT(s.id) as score_count,
  STRING_AGG(DISTINCT s.tournament_id::text, ', ') as score_tournament_ids
FROM games g
LEFT JOIN scores s ON g.id = s.game_id
WHERE g.name ILIKE '%joust%'
GROUP BY g.id, g.name, g.tournament_id;
