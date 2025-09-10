-- Break RLS recursion cycles between tournaments and tournament_members

-- 1) Drop ALL existing policies on tournament_members
do $$ declare r record; begin
  for r in (
    select policyname from pg_policies where schemaname='public' and tablename='tournament_members'
  ) loop
    execute 'drop policy ' || quote_ident(r.policyname) || ' on public.tournament_members';
  end loop;
end $$;

-- 2) Recreate minimal, non-recursive tournament_members policies (self-based only)
create policy "tm_select_self" on public.tournament_members
  for select using (user_id = auth.uid());

create policy "tm_insert_self_public" on public.tournament_members
  for insert with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_members.tournament_id
        and t.is_public = true
    )
  );

create policy "tm_update_self" on public.tournament_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "tm_delete_self" on public.tournament_members
  for delete using (user_id = auth.uid());

-- 3) Replace tournaments SELECT policy to allow owners, public, or members (via tm)
do $$ begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournaments' and policyname='tournaments_select_public_or_member'
  ) then
    execute 'drop policy "tournaments_select_public_or_member" on public.tournaments';
  end if;
end $$;

create policy "tournaments_select_public_owner_or_member" on public.tournaments
  for select using (
    is_public = true
    or created_by = auth.uid()
    or exists (
      select 1 from public.tournament_members tm
      where tm.tournament_id = tournaments.id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );


