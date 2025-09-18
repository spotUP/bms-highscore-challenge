-- Fix anonymous access to public tournaments
-- The current policy fails for anonymous users because auth.uid() is null

-- Drop the existing policy
DROP POLICY IF EXISTS "tournaments_select_public_owner_or_member" ON public.tournaments;

-- Create new policy that properly handles anonymous users
CREATE POLICY "tournaments_select_public_owner_or_member" ON public.tournaments
  FOR SELECT USING (
    -- Allow if tournament is public (no auth required)
    is_public = true
    -- OR if authenticated user is the owner
    OR (auth.uid() IS NOT NULL AND created_by = auth.uid())
    -- OR if authenticated user is an active member
    OR (
      auth.uid() IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.tournament_members tm
        WHERE tm.tournament_id = tournaments.id
          AND tm.user_id = auth.uid()
          AND tm.is_active = true
      )
    )
  );
