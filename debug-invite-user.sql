-- Debug script to check user_roles table and invite functionality

-- 1. Check if user_roles table exists and its structure
SELECT 
  'USER_ROLES TABLE STRUCTURE' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check user_id data type in user_roles
SELECT 
  'USER_ID DATA TYPE CHECK' as section,
  pg_typeof(user_id) as user_id_type,
  user_id,
  role
FROM user_roles 
LIMIT 3;

-- 3. Check current user_roles data (without join for now)
SELECT 
  'CURRENT USER ROLES' as section,
  ur.*
FROM user_roles ur
ORDER BY ur.created_at DESC
LIMIT 10;

-- 4. Check what roles are allowed (if there's an enum constraint)
SELECT 
  'ROLE ENUM VALUES' as section,
  enumlabel as allowed_role
FROM pg_enum 
WHERE enumtypid = (
  SELECT oid 
  FROM pg_type 
  WHERE typname = 'user_role_enum'
);

-- 5. Check if there are any foreign key constraints
SELECT 
  'FOREIGN KEY CONSTRAINTS' as section,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'user_roles';

-- 6. Test inserting a dummy role with proper UUID (will fail if there are constraint issues)
-- This is just a test - we'll rollback
BEGIN;
  INSERT INTO user_roles (user_id, role) 
  VALUES ('123e4567-e89b-12d3-a456-426614174000'::uuid, 'user');
  SELECT 'ROLE INSERT TEST' as section, 'SUCCESS' as result;
ROLLBACK;
