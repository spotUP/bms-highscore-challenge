-- Manual script to create the default tournament
-- Run this in your Supabase SQL editor

-- First, check what columns exist in the tournaments table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tournaments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if the default tournament already exists (using only existing columns)
SELECT id, name, slug, is_public, created_by 
FROM public.tournaments 
WHERE slug = 'default-arcade';

-- If it doesn't exist, create it (using only existing columns)
INSERT INTO public.tournaments (
  id, 
  name, 
  slug, 
  description, 
  is_public, 
  created_by, 
  created_at, 
  updated_at
)
SELECT 
  gen_random_uuid(), 
  'Default Arcade Tournament', 
  'default-arcade', 
  'Preconfigured public tournament for anonymous users and new players', 
  true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  now(), 
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tournaments WHERE slug = 'default-arcade'
);

-- Add the owner as a member
INSERT INTO public.tournament_members (
  tournament_id,
  user_id,
  role,
  is_active
)
SELECT 
  t.id,
  t.created_by,
  'owner',
  true
FROM public.tournaments t
WHERE t.slug = 'default-arcade'
  AND NOT EXISTS (
    SELECT 1 FROM public.tournament_members tm 
    WHERE tm.tournament_id = t.id AND tm.user_id = t.created_by
  );

-- Verify the tournament was created
SELECT 
  t.id, 
  t.name, 
  t.slug, 
  t.is_public, 
  t.created_by,
  tm.role as owner_role
FROM public.tournaments t
LEFT JOIN public.tournament_members tm ON t.id = tm.tournament_id AND tm.user_id = t.created_by
WHERE t.slug = 'default-arcade';
