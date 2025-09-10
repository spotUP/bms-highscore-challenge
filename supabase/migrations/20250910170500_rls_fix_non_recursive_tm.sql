-- Fix recursion by replacing tournament_members policies with non-recursive variants

-- Drop existing tournament_members policies if they exist
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='tournament_members' and policyname='tm_select_self_or_admin') then
    execute 'drop policy "tm_select_self_or_admin" on public.tournament_members';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='tournament_members' and policyname='tm_insert_self_public_or_admin') then
    execute 'drop policy "tm_insert_self_public_or_admin" on public.tournament_members';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='tournament_members' and policyname='tm_update_self_or_admin') then
    execute 'drop policy "tm_update_self_or_admin" on public.tournament_members';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='tournament_members' and policyname='tm_delete_admin') then
    execute 'drop policy "tm_delete_admin" on public.tournament_members';
  end if;
end $$;

-- New policies: avoid calling helper that queries tournament_members to prevent recursion

-- SELECT: member sees own row; tournament owner sees all rows for their tournaments
create policy "tm_select_self_or_owner" on public.tournament_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_members.tournament_id
        and t.created_by = auth.uid()
    )
  );

-- INSERT: allow self-join for public tournaments; allow tournament owner to add members
create policy "tm_insert_self_public_or_owner" on public.tournament_members
  for insert with check (
    (
      auth.uid() is not null
      and user_id = auth.uid()
      and exists (
        select 1 from public.tournaments t
        where t.id = tournament_members.tournament_id
          and t.is_public = true
      )
    )
    or (
      exists (
        select 1 from public.tournaments t
        where t.id = tournament_members.tournament_id
          and t.created_by = auth.uid()
      )
    )
  );

-- UPDATE: member can update/leave their own row; owner can update any member row
create policy "tm_update_self_or_owner" on public.tournament_members
  for update using (
    user_id = auth.uid()
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_members.tournament_id
        and t.created_by = auth.uid()
    )
  ) with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_members.tournament_id
        and t.created_by = auth.uid()
    )
  );

-- DELETE: owner can remove members
create policy "tm_delete_owner" on public.tournament_members
  for delete using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_members.tournament_id
        and t.created_by = auth.uid()
    )
  );


