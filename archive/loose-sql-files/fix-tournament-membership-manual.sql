-- Fix tournament membership - Manual version for Supabase SQL Editor
-- First, let's find your user ID and tournament info

-- Step 1: Show all users (to find your user ID)
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Step 2: Show all tournaments
SELECT 
  id as tournament_id,
  name,
  slug,
  created_by,
  created_at
FROM tournaments
ORDER BY created_at;

-- Step 3: Show current tournament memberships
SELECT 
  tm.id,
  tm.tournament_id,
  tm.user_id,
  tm.role,
  tm.is_active,
  t.name as tournament_name,
  u.email as user_email
FROM tournament_members tm
JOIN tournaments t ON tm.tournament_id = t.id
JOIN auth.users u ON tm.user_id = u.id
ORDER BY tm.created_at;

-- Step 4: Manual fix - REPLACE 'YOUR_USER_ID_HERE' with your actual user ID from Step 1
-- and 'YOUR_TOURNAMENT_ID_HERE' with the tournament ID from Step 2
-- Uncomment and modify the lines below:

/*
-- Replace these values with the actual IDs from the queries above:
-- YOUR_USER_ID_HERE: Copy the 'user_id' from Step 1 (your email row)
-- YOUR_TOURNAMENT_ID_HERE: Copy the 'tournament_id' from Step 2 (Default Arcade Tournament row)

INSERT INTO tournament_members (tournament_id, user_id, role, is_active)
VALUES (
  'YOUR_TOURNAMENT_ID_HERE'::uuid,
  'YOUR_USER_ID_HERE'::uuid,
  'owner',
  true
)
ON CONFLICT (tournament_id, user_id) 
DO UPDATE SET 
  role = 'owner',
  is_active = true,
  updated_at = NOW();
*/

-- After running the INSERT above, verify it worked:
/*
SELECT 
  tm.role,
  tm.is_active,
  t.name as tournament_name,
  u.email as user_email
FROM tournament_members tm
JOIN tournaments t ON tm.tournament_id = t.id
JOIN auth.users u ON tm.user_id = u.id
WHERE tm.user_id = 'YOUR_USER_ID_HERE'::uuid;
*/
