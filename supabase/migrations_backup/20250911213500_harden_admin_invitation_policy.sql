-- Ensure admin invitation policy includes WITH CHECK to constrain INSERT/UPDATE

-- Drop existing admin policy if present
DROP POLICY IF EXISTS "Tournament admins can manage invitations" ON public.tournament_invitations;

-- Recreate with USING and WITH CHECK mirroring the admin condition
CREATE POLICY "Tournament admins can manage invitations" ON public.tournament_invitations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_members tm
      WHERE tm.tournament_id = tournament_invitations.tournament_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
        AND tm.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournament_members tm
      WHERE tm.tournament_id = tournament_invitations.tournament_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
        AND tm.is_active = true
    )
  );
