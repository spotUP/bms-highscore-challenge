-- Temporary fix: Disable RLS recursion by simplifying policies
-- This will temporarily allow access to fix the underlying issues

-- Step 1: Drop all problematic policies
DROP POLICY IF EXISTS "tournaments_select" ON public.tournaments;
DROP POLICY IF EXISTS "tournament_members_select" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_insert" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_update" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_delete" ON public.tournament_members;

-- Step 2: Temporarily disable RLS to allow basic access
ALTER TABLE public.tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_invitations DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify the tournament setup
SELECT
  t.id as tournament_id,
  t.name as tournament_name,
  t.slug,
  COUNT(tm.id) as member_count,
  STRING_AGG(tm.role::text, ', ') as roles
FROM public.tournaments t
LEFT JOIN public.tournament_members tm ON t.id = tm.tournament_id AND tm.is_active = true
GROUP BY t.id, t.name, t.slug
ORDER BY t.created_at;

-- Step 4: Check user's membership
SELECT
  tm.id,
  tm.tournament_id,
  tm.user_id,
  tm.role,
  tm.is_active,
  t.name as tournament_name
FROM public.tournament_members tm
JOIN public.tournaments t ON tm.tournament_id = t.id
WHERE tm.user_id = '6a5550ca-ec3e-413d-9a9b-e20ec827f045'
AND tm.is_active = true;
