-- DEMOLITION MAN ETERNAL LEADERBOARD SETUP
-- Copy and paste this entire script into your Supabase SQL Editor and run it

-- Step 1: Insert Demolition Man game if it doesn't already exist
INSERT INTO public.games (
  id,
  name,
  description,
  logo_url,
  is_active,
  include_in_challenge,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  'Demolition Man',
  'Eternal leaderboard for Demolition Man arcade game - scores never reset',
  'https://images.launchbox-app.com/c84bf29b-1b54-4310-9290-9b52f587f442.png',
  true,
  false, -- Not included in regular challenge competitions
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.games WHERE name = 'Demolition Man'
);

-- Step 2: Create function to ensure Demolition Man game exists
CREATE OR REPLACE FUNCTION ensure_demolition_man_game()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  game_id uuid;
BEGIN
  -- Try to get existing Demolition Man game
  SELECT id INTO game_id 
  FROM public.games 
  WHERE name = 'Demolition Man'
  LIMIT 1;
  
  -- If not found, create it
  IF game_id IS NULL THEN
    INSERT INTO public.games (
      id,
      name,
      description,
      logo_url,
      is_active,
      include_in_challenge,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      'Demolition Man',
      'Eternal leaderboard for Demolition Man arcade game - scores never reset',
      'https://images.launchbox-app.com/c84bf29b-1b54-4310-9290-9b52f587f442.png',
      true,
      false, -- Not included in regular challenge competitions
      now(),
      now()
    )
    RETURNING id INTO game_id;
    
    RAISE NOTICE 'Created Demolition Man game with ID: %', game_id;
  ELSE
    RAISE NOTICE 'Demolition Man game already exists with ID: %', game_id;
  END IF;
  
  RETURN game_id;
END;
$$;

-- Step 3: Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION ensure_demolition_man_game() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_demolition_man_game() TO anon;

-- Step 4: Test the function
SELECT ensure_demolition_man_game() as demolition_man_game_id;

-- Step 5: Verify the game was created
SELECT 
  id,
  name,
  description,
  is_active,
  include_in_challenge,
  created_at
FROM public.games 
WHERE name = 'Demolition Man';

-- Step 6: Show any existing Demolition Man scores
SELECT 
  s.player_name,
  s.score,
  s.created_at,
  g.name as game_name
FROM public.scores s
JOIN public.games g ON s.game_id = g.id
WHERE g.name = 'Demolition Man'
ORDER BY s.score DESC
LIMIT 10;
