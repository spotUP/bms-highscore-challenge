-- Ensure a public default tournament exists and auto-join new users

-- If there is at least one user, create a public default tournament owned by the first user
insert into public.tournaments (id, name, slug, description, is_public, created_by, created_at, updated_at)
select gen_random_uuid(), 'Default Arcade Tournament', 'default-arcade', 'Preconfigured public tournament', true,
  (select id from auth.users order by created_at asc limit 1), now(), now()
where exists (select 1 from auth.users)
  and not exists (
    select 1 from public.tournaments t where t.slug = 'default-arcade'
  );

-- 2) Helper to fetch default tournament id
create or replace function public.get_default_tournament_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.tournaments where slug = 'default-arcade' limit 1
$$;

alter function public.get_default_tournament_id() owner to postgres;

-- Skipping trigger on auth.users to avoid elevated privileges; app already
-- falls back to the default public tournament when a user has no memberships.


