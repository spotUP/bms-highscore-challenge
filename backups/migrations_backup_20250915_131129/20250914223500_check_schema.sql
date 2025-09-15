-- Check if the games table exists
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'games'
) AS games_table_exists;

-- Check if the scores table exists
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'scores'
) AS scores_table_exists;

-- List all tables in the public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check if the user_roles table exists
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_roles'
) AS user_roles_table_exists;

-- Check if the app_role enum type exists
SELECT EXISTS (
  SELECT 1 
  FROM pg_type 
  WHERE typname = 'app_role'
) AS app_role_enum_exists;
