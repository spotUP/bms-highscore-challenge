-- Fix tournament membership for the current user
-- Run this as your authenticated user in Supabase SQL Editor

DO $$
DECLARE
  default_tournament_id UUID;
  current_user_id UUID;
  membership_exists BOOLEAN;
BEGIN
  -- Get the current authenticated user
  SELECT auth.uid() INTO current_user_id;
  
  -- If no authenticated user, show error
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found. Please make sure you are logged in when running this script.';
  END IF;
  
  RAISE NOTICE 'Current user ID: %', current_user_id;
  
  -- Find the default tournament
  SELECT id INTO default_tournament_id
  FROM tournaments
  WHERE slug = 'default-arcade'
  OR name = 'Default Arcade Tournament'
  LIMIT 1;
  
  IF default_tournament_id IS NULL THEN
    RAISE EXCEPTION 'Default tournament not found. Please check if the migration was completed successfully.';
  END IF;
  
  RAISE NOTICE 'Default tournament ID: %', default_tournament_id;
  
  -- Check if membership already exists
  SELECT EXISTS(
    SELECT 1 FROM tournament_members 
    WHERE tournament_id = default_tournament_id 
    AND user_id = current_user_id
  ) INTO membership_exists;
  
  IF membership_exists THEN
    RAISE NOTICE 'User is already a member of the default tournament';
    
    -- Update to make sure they are active and owner
    UPDATE tournament_members 
    SET role = 'owner', is_active = true, updated_at = NOW()
    WHERE tournament_id = default_tournament_id 
    AND user_id = current_user_id;
    
    RAISE NOTICE 'Updated user role to owner and set as active';
  ELSE
    -- Add user as owner of the default tournament
    INSERT INTO tournament_members (tournament_id, user_id, role, is_active)
    VALUES (default_tournament_id, current_user_id, 'owner', true);
    
    RAISE NOTICE 'Added user as owner of the default tournament';
  END IF;
  
  -- Verify the membership
  SELECT role INTO STRICT current_user_id FROM tournament_members 
  WHERE tournament_id = default_tournament_id 
  AND user_id = (SELECT auth.uid());
  
  RAISE NOTICE 'User role in default tournament: %', current_user_id;
  RAISE NOTICE 'Tournament membership fix completed successfully!';
  
END $$;

-- Also verify the tournament exists and show some info
SELECT 
  t.id,
  t.name,
  t.slug,
  t.created_by,
  COUNT(tm.id) as member_count
FROM tournaments t
LEFT JOIN tournament_members tm ON t.id = tm.tournament_id AND tm.is_active = true
GROUP BY t.id, t.name, t.slug, t.created_by
ORDER BY t.created_at;
