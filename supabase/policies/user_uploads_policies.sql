begin;
set local role postgres;

alter table storage.objects enable row level security;

drop policy if exists "user-uploads insert own" on storage.objects;
drop policy if exists "user-uploads read own"   on storage.objects;
drop policy if exists "user-uploads update own" on storage.objects;
drop policy if exists "user-uploads delete own" on storage.objects;

create policy "user-uploads insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "user-uploads read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "user-uploads update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "user-uploads delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

reset role;
commit;
