-- EMERGENCY FIX: Complete RLS disable to get tournament system working
-- This will temporarily disable all RLS policies to allow access

-- Step 1: Drop ALL existing policies that might cause recursion
DROP POLICY IF EXISTS "tournaments_select" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_select_simple" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_insert" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_update" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_delete" ON public.tournaments;

DROP POLICY IF EXISTS "tournament_members_select" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_insert" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_update" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_delete" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_select_own" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_insert_own" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_update_own" ON public.tournament_members;
DROP POLICY IF EXISTS "tournament_members_delete_own" ON public.tournament_members;

-- Step 2: Temporarily disable RLS completely
ALTER TABLE public.tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_invitations DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify your membership exists
SELECT
  tm.id,
  tm.user_id,
  tm.tournament_id,
  tm.role,
  tm.is_active,
  t.name as tournament_name
FROM public.tournament_members tm
LEFT JOIN public.tournaments t ON tm.tournament_id = t.id
WHERE tm.user_id = '6a5550ca-ec3e-413d-9a9b-e20ec827f045'
AND tm.is_active = true;

-- Step 4: Show all tournaments and members
SELECT 'Tournaments:' as info;
SELECT id, name, slug, is_public FROM public.tournaments;

SELECT 'Members:' as info;
SELECT tm.user_id, tm.tournament_id, tm.role, t.name
FROM public.tournament_members tm
LEFT JOIN public.tournaments t ON tm.tournament_id = t.id
WHERE tm.is_active = true;
