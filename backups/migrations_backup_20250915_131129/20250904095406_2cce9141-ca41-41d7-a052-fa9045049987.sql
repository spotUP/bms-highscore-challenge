-- Add unique constraint to ensure one score per player per game
-- First, remove any duplicate scores (keeping only the highest score per player per game)
DELETE FROM public.scores 
WHERE id NOT IN (
  SELECT DISTINCT ON (player_name, game_id) id
  FROM public.scores
  ORDER BY player_name, game_id, score DESC
);

-- Add unique constraint to prevent multiple scores per player per game
ALTER TABLE public.scores 
ADD CONSTRAINT unique_player_game UNIQUE (player_name, game_id);