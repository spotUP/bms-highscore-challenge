-- Ensure Demolition Man game always exists in the database
-- This migration will create the Demolition Man game if it doesn't exist

-- Insert Demolition Man game if it doesn't already exist
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
  'demolition-man'::uuid,
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

-- Create a function to ensure Demolition Man game exists
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
  END IF;
  
  RETURN game_id;
END;
$$;

-- Create a trigger function to automatically ensure Demolition Man exists
-- when someone tries to submit a score for it
CREATE OR REPLACE FUNCTION auto_create_demolition_man()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  dm_game_id uuid;
BEGIN
  -- Check if this is a demolition man score submission attempt
  -- Look for game_id that matches 'demolition-man' or doesn't exist
  SELECT id INTO dm_game_id 
  FROM public.games 
  WHERE id = NEW.game_id;
  
  -- If game doesn't exist and we're trying to insert with a specific UUID
  -- that suggests it's meant to be Demolition Man, create it
  IF dm_game_id IS NULL AND NEW.game_id::text = 'demolition-man' THEN
    -- Ensure Demolition Man game exists
    SELECT ensure_demolition_man_game() INTO dm_game_id;
    -- Update the NEW record to use the correct ID
    NEW.game_id := dm_game_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on scores table to auto-create Demolition Man game
DROP TRIGGER IF EXISTS trigger_auto_create_demolition_man ON public.scores;
CREATE TRIGGER trigger_auto_create_demolition_man
  BEFORE INSERT ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_demolition_man();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION ensure_demolition_man_game() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_create_demolition_man() TO authenticated;
