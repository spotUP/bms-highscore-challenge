-- Automatic tournament membership fix
-- This will add the user as owner of the current tournament

DO $$
DECLARE
  current_tournament_id UUID;
  current_user_id UUID := '6a5550ca-ec3e-413d-9a9b-e20ec827f045'; -- Your user ID
  membership_exists BOOLEAN;
BEGIN
  -- Find the current tournament (BMS Highscore Challenge)
  SELECT id INTO current_tournament_id
  FROM tournaments
  WHERE slug = 'bms-highscore-challenge'
  OR name = 'BMS Highscore Challenge'
  LIMIT 1;
  
  IF current_tournament_id IS NULL THEN
    RAISE EXCEPTION 'BMS Highscore Challenge tournament not found. Please check if the migration was completed successfully.';
  END IF;

  RAISE NOTICE 'Found BMS Highscore Challenge tournament ID: %', current_tournament_id;
  RAISE NOTICE 'Using user ID: %', current_user_id;
  
  -- Check if membership already exists
  SELECT EXISTS(
    SELECT 1 FROM tournament_members
    WHERE tournament_id = current_tournament_id
    AND user_id = current_user_id
  ) INTO membership_exists;

  IF membership_exists THEN
    RAISE NOTICE 'User is already a member of the BMS Highscore Challenge tournament';

    -- Update to make sure they are active and owner
    UPDATE tournament_members
    SET role = 'owner', is_active = true, updated_at = NOW()
    WHERE tournament_id = current_tournament_id
    AND user_id = current_user_id;

    RAISE NOTICE 'Updated user role to owner and set as active';
  ELSE
    -- Add user as owner of the BMS Highscore Challenge tournament
    INSERT INTO tournament_members (tournament_id, user_id, role, is_active)
    VALUES (current_tournament_id, current_user_id, 'owner', true);

    RAISE NOTICE 'Added user as owner of the BMS Highscore Challenge tournament';
  END IF;
  
  RAISE NOTICE 'Tournament membership fix completed successfully!';
  
END $$;

-- Verify the result
SELECT 
  tm.role,
  tm.is_active,
  t.name as tournament_name,
  u.email as user_email,
  tm.created_at
FROM tournament_members tm
JOIN tournaments t ON tm.tournament_id = t.id
JOIN auth.users u ON tm.user_id = u.id
ORDER BY tm.created_at;
