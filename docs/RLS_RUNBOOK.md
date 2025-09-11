# RLS Runbook

This runbook helps audit and remediate cases where policies exist but Row Level Security (RLS) is disabled.

See also: `scripts/verify-rls-state.sql` and GitHub Action `.github/workflows/rls-verify.yml`.

## Verification Queries

Run in Supabase SQL editor (read-only):

```sql
-- 1) Tables with policies but RLS disabled (should be empty)
select distinct p.schemaname,
       p.tablename,
       c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies pp where pp.schemaname=p.schemaname and pp.tablename=p.tablename) as policy_count
from pg_policies p
join pg_class c on c.relname = p.tablename
join pg_namespace n on n.oid = c.relnamespace and n.nspname = p.schemaname
where c.relkind = 'r' and c.relrowsecurity = false
order by 1, 2;

-- 2) Overview of tables with policies
select p.schemaname,
       p.tablename,
       c.relrowsecurity as rls_enabled,
       count(*) as policy_count
from pg_policies p
join pg_class c on c.relname = p.tablename
join pg_namespace n on n.oid = c.relnamespace and n.nspname = p.schemaname
where c.relkind = 'r'
GROUP BY 1,2,3
order by 1,2;

-- 3) Policies per table (for context)
select p.schemaname,
       p.tablename,
       p.policyname,
       p.cmd as for_command,
       p.permissive
from pg_policies p
order by 1,2,3;
```

## Remediation

Enable RLS only on the specific tables that return from Query (1):

```sql
begin;

alter table schema_name.table_name enable row level security;
-- Repeat for each flagged table

commit;
```

To reverse for a specific table if needed:

```sql
alter table schema_name.table_name disable row level security;
```

## CI (GitHub Actions)

Workflow: `.github/workflows/rls-verify.yml`

- Requires repo secret: `STAGING_DATABASE_URL` (a Postgres connection string pointing to staging or prod).
- The job fails if any table has policies but RLS is disabled. An artifact with the list is uploaded on failure.
- Scheduled to run daily and can be triggered manually via `workflow_dispatch`.

## Migration for Consistency

Migration file: `supabase/migrations/20250911150500_enable_rls_where_policies_exist.sql`

- Programmatically enables RLS on any table that has policies but currently has RLS disabled.
- Safe-by-default, avoids touching tables without policies.

## Smoke Tests (App-Level)

After enabling RLS on a table, verify:

- Authenticated users can still read the data they’re supposed to (public or self-scoped).
- Users cannot read/update other users’ data.
- Admin paths continue to work (e.g., invites, admin writes).

If a path fails, confirm the policy on that table allows the exact operation for the acting role/user, and adjust narrowly.
