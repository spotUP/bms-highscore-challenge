# Changelog

## [v1.8.1] - 2025-09-11

Maintenance release to publish a GitHub Release via the new workflow. Contents are identical to v1.8.0.

## [v1.8.0] - 2025-09-11

### Added
- Auth resilience:
  - New page `src/pages/AuthVerify.tsx` for 6-digit code verification (invite & recovery)
  - New page `src/pages/LinkExpired.tsx` with quick actions when links fail
  - Routes `/auth/verify` and `/auth/expired` wired in `src/App.tsx`
  - Admin “Resend Invite” in `src/components/UserManagement.tsx`
- Security hardening:
  - Baseline CSP meta added to `index.html`
  - RLS: enabled where policies already exist; added `scripts/verify-rls-state.sql`
  - Storage RLS: migration to enable RLS only where policies exist in `storage.*`
  - Env: require `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with local/CI checks
- CI/Docs:
  - `.github/workflows/rls-verify.yml` to prevent SUPA_policy_exists_rls_disabled regressions (staging + optional prod)
  - `.github/workflows/env-check.yml` for required envs
  - `docs/RLS_RUNBOOK.md` runbook and queries

### Changed
- `src/integrations/supabase/client.ts`: removed hardcoded Supabase URL/key fallbacks; now fails fast if envs are missing.

### Notes
- After confirming envs in all environments, rotate the Supabase anon key and redeploy.
