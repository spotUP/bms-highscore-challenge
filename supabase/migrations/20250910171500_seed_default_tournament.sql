-- Ensure a public default tournament exists and auto-join new users

-- 1) Upsert default tournament (public)
insert into public.tournaments (id, name, slug, description, is_public, created_by, created_at, updated_at)
select gen_random_uuid(), 'Default Arcade Tournament', 'default-arcade', 'Preconfigured public tournament', true, '00000000-0000-0000-0000-000000000000', now(), now()
where not exists (
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

-- 3) Trigger to auto-join new users to default tournament
create or replace function public.auto_join_default_tournament()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
begin
  select public.get_default_tournament_id() into v_tournament_id;
  if v_tournament_id is null then
    return new;
  end if;

  -- Insert membership if not exists
  insert into public.tournament_members (tournament_id, user_id, role, is_active, joined_at, invited_by)
  select v_tournament_id, new.id, 'member', true, now(), null
  where not exists (
    select 1 from public.tournament_members tm
    where tm.tournament_id = v_tournament_id and tm.user_id = new.id
  );

  return new;
end;
$$;

alter function public.auto_join_default_tournament() owner to postgres;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_auto_join_default_tournament'
  ) then
    execute 'create trigger trg_auto_join_default_tournament
      after insert on auth.users
      for each row execute function public.auto_join_default_tournament()';
  end if;
end $$;


