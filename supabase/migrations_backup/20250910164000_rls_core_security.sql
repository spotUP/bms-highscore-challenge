-- Core RLS policies for tournaments, tournament_members, and scores
-- Non-breaking: adds missing policies; prefers least-privilege access

-- Helper: check if a user is an active member of a tournament, optionally with one of the given roles
create or replace function public.is_tournament_member(p_user uuid, p_tournament uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tournament_members tm
    where tm.user_id = p_user
      and tm.tournament_id = p_tournament
      and tm.is_active = true
      and (
        p_roles is null
        or tm.role::text = any (p_roles)
      )
  );
$$;

-- Ensure ownership for SECURITY DEFINER function
alter function public.is_tournament_member(uuid, uuid, text[]) owner to postgres;

-- Enable RLS on core tables (no-op if already enabled)
do $$ begin
  perform 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tournaments' and c.relrowsecurity; 
  if not found then execute 'alter table public.tournaments enable row level security'; end if;
end $$;

do $$ begin
  perform 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='tournament_members' and c.relrowsecurity; 
  if not found then execute 'alter table public.tournament_members enable row level security'; end if;
end $$;

do $$ begin
  perform 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='scores' and c.relrowsecurity; 
  if not found then execute 'alter table public.scores enable row level security'; end if;
end $$;

-- POLICIES: TOURNAMENTS
-- SELECT: allow if public OR creator OR active member
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournaments' and policyname='tournaments_select_public_or_member'
  ) then
    execute 'create policy "tournaments_select_public_or_member" on public.tournaments
      for select using (
        is_public = true
        or created_by = auth.uid()
        or public.is_tournament_member(auth.uid(), id)
      )';
  end if;
end $$;

-- INSERT: only authenticated; created_by must equal auth.uid()
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournaments' and policyname='tournaments_insert_owner'
  ) then
    execute 'create policy "tournaments_insert_owner" on public.tournaments
      for insert with check (
        auth.uid() is not null and created_by = auth.uid()
      )';
  end if;
end $$;

-- UPDATE/DELETE: owner or admin of the tournament
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournaments' and policyname='tournaments_modify_owner_or_admin'
  ) then
    execute 'create policy "tournaments_modify_owner_or_admin" on public.tournaments
      for all using (
        created_by = auth.uid() or public.is_tournament_member(auth.uid(), id, array[''owner'',''admin''])
      ) with check (
        created_by = auth.uid() or public.is_tournament_member(auth.uid(), id, array[''owner'',''admin''])
      )';
  end if;
end $$;

-- POLICIES: TOURNAMENT_MEMBERS
-- SELECT: members can see their row; owners/admins can see all for their tournaments
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournament_members' and policyname='tm_select_self_or_admin'
  ) then
    execute 'create policy "tm_select_self_or_admin" on public.tournament_members
      for select using (
        user_id = auth.uid() or public.is_tournament_member(auth.uid(), tournament_id, array[''owner'',''admin''])
      )';
  end if;
end $$;

-- INSERT: user can self-join public tournaments; admins/owners can add members
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournament_members' and policyname='tm_insert_self_public_or_admin'
  ) then
    execute 'create policy "tm_insert_self_public_or_admin" on public.tournament_members
      for insert with check (
        (
          auth.uid() is not null
          and user_id = auth.uid()
          and exists (select 1 from public.tournaments t where t.id = tournament_id and t.is_public = true)
        )
        or (
          public.is_tournament_member(auth.uid(), tournament_id, array[''owner'',''admin''])
        )
      )';
  end if;
end $$;

-- UPDATE: member can deactivate self (leave); admins/owners can update any membership
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournament_members' and policyname='tm_update_self_or_admin'
  ) then
    execute 'create policy "tm_update_self_or_admin" on public.tournament_members
      for update using (
        user_id = auth.uid() or public.is_tournament_member(auth.uid(), tournament_id, array[''owner'',''admin''])
      ) with check (
        user_id = auth.uid() or public.is_tournament_member(auth.uid(), tournament_id, array[''owner'',''admin''])
      )';
  end if;
end $$;

-- DELETE: admins/owners only
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournament_members' and policyname='tm_delete_admin'
  ) then
    execute 'create policy "tm_delete_admin" on public.tournament_members
      for delete using (
        public.is_tournament_member(auth.uid(), tournament_id, array[''owner'',''admin''])
      )';
  end if;
end $$;

-- POLICIES: SCORES
-- Assumes scores(user_id uuid, tournament_id uuid, ...)
-- SELECT: visible if public tournament or member
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='scores' and policyname='scores_select_public_or_member'
  ) then
    execute 'create policy "scores_select_public_or_member" on public.scores
      for select using (
        exists (
          select 1 from public.tournaments t
          where t.id = scores.tournament_id
            and (
              t.is_public = true
              or public.is_tournament_member(auth.uid(), t.id)
            )
        )
      )';
  end if;
end $$;

-- INSERT: only the authenticated user can insert their own scores for tournaments they can access
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='scores' and policyname='scores_insert_own_member'
  ) then
    execute 'create policy "scores_insert_member" on public.scores
      for insert with check (
        auth.uid() is not null
        and exists (
          select 1 from public.tournaments t
          where t.id = scores.tournament_id
            and (
              t.is_public = true
              or public.is_tournament_member(auth.uid(), t.id)
            )
        )
      )';
  end if;
end $$;

-- UPDATE/DELETE: score owner or tournament admin/owner
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='scores' and policyname='scores_modify_owner_or_admin'
  ) then
    execute 'create policy "scores_modify_admin" on public.scores
      for all using (
        public.is_tournament_member(auth.uid(), tournament_id, array[''owner'',''admin''])
      ) with check (
        public.is_tournament_member(auth.uid(), tournament_id, array[''owner'',''admin''])
      )';
  end if;
end $$;


