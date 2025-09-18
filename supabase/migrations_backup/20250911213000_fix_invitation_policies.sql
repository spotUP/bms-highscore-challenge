-- Harden RLS for tournament invitations to prevent email/token harvesting
-- Context: Only tournament admins should manage invitations, and invited users
-- should be able to see their own active (unexpired, unused) invitations.

-- Safety: ensure RLS is enabled
ALTER TABLE public.tournament_invitations ENABLE ROW LEVEL SECURITY;

-- Backfill schema differences across environments: ensure used_at exists
ALTER TABLE public.tournament_invitations
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Allow invited user to view their own active invitation rows
-- (matches on email of the authenticated user; case-insensitive)
CREATE POLICY "Invited users can view their own invitations" ON public.tournament_invitations
  FOR SELECT
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND used_at IS NULL
    AND now() <= expires_at
  );

-- Ensure admins continue to fully manage invitations (already present in base migration):
--   CREATE POLICY "Tournament admins can manage invitations" ON public.tournament_invitations
--     FOR ALL USING ( ... role IN ('owner','admin') ... );
-- If the above policy name was changed previously, keep it. This migration only adds the invited-user SELECT policy.

-- Optional defense-in-depth: ensure no access for anonymous users beyond RLS (no explicit grants)
REVOKE ALL ON public.tournament_invitations FROM anon;
-- Keep authenticated grants (existing migration granted DML to authenticated; RLS still applies)
