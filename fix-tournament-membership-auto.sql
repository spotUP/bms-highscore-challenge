-- Automatic tournament membership fix
-- This will add the first admin user as owner of the default tournament

DO $$
DECLARE
  default_tournament_id UUID;
  admin_user_id UUID;
  membership_exists BOOLEAN;
BEGIN
  -- Find the default tournament
  SELECT id INTO default_tournament_id
  FROM tournaments
  WHERE slug = 'default-arcade'
  OR name = 'Default Arcade Tournament'
  OR name LIKE '%Default%'
  LIMIT 1;
  
  IF default_tournament_id IS NULL THEN
    RAISE EXCEPTION 'Default tournament not found. Please check if the migration was completed successfully.';
  END IF;
  
  RAISE NOTICE 'Found default tournament ID: %', default_tournament_id;
  
  -- Find the first admin user (from the old user_roles table)
  SELECT ur.user_id INTO admin_user_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    -- If no admin user found, try to get the first user
    SELECT id INTO admin_user_id
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in the system.';
  END IF;
  
  RAISE NOTICE 'Using user ID: %', admin_user_id;
  
  -- Check if membership already exists
  SELECT EXISTS(
    SELECT 1 FROM tournament_members 
    WHERE tournament_id = default_tournament_id 
    AND user_id = admin_user_id
  ) INTO membership_exists;
  
  IF membership_exists THEN
    RAISE NOTICE 'User is already a member of the default tournament';
    
    -- Update to make sure they are active and owner
    UPDATE tournament_members 
    SET role = 'owner', is_active = true, updated_at = NOW()
    WHERE tournament_id = default_tournament_id 
    AND user_id = admin_user_id;
    
    RAISE NOTICE 'Updated user role to owner and set as active';
  ELSE
    -- Add user as owner of the default tournament
    INSERT INTO tournament_members (tournament_id, user_id, role, is_active)
    VALUES (default_tournament_id, admin_user_id, 'owner', true);
    
    RAISE NOTICE 'Added user as owner of the default tournament';
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
