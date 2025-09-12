-- Bracket competitions schema (separate from highscore tournaments)
create extension if not exists pgcrypto;

-- Competitions
create table if not exists public.bracket_competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  is_public boolean not null default false,
  is_locked boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bracket_competitions_created_by on public.bracket_competitions(created_by);

-- Participants (can be users or just named slots)
create table if not exists public.bracket_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.bracket_competitions(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  display_name text not null,
  seed integer null,
  created_at timestamptz not null default now()
);

create index if not exists idx_bracket_participants_comp on public.bracket_participants(competition_id);

-- Matches (single-elimination initial support)
create table if not exists public.bracket_matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.bracket_competitions(id) on delete cascade,
  round integer not null check (round >= 1),
  position integer not null check (position >= 1),
  participant1_id uuid null references public.bracket_participants(id) on delete set null,
  participant2_id uuid null references public.bracket_participants(id) on delete set null,
  winner_participant_id uuid null references public.bracket_participants(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  reported_by uuid null references auth.users(id) on delete set null,
  reported_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, round, position)
);

create index if not exists idx_bracket_matches_comp on public.bracket_matches(competition_id);
create index if not exists idx_bracket_matches_round on public.bracket_matches(competition_id, round);

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

create trigger tr_bracket_competitions_updated
before update on public.bracket_competitions
for each row execute function public.set_updated_at();

create trigger tr_bracket_matches_updated
before update on public.bracket_matches
for each row execute function public.set_updated_at();

-- Basic RLS (optional simplified)
alter table public.bracket_competitions enable row level security;
alter table public.bracket_participants enable row level security;
alter table public.bracket_matches enable row level security;

-- Owners can manage their competitions; public read if is_public
create policy if not exists bracket_competitions_select on public.bracket_competitions
  for select using (is_public or auth.uid() = created_by);
create policy if not exists bracket_competitions_insert on public.bracket_competitions
  for insert with check (auth.uid() = created_by);
create policy if not exists bracket_competitions_update on public.bracket_competitions
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy if not exists bracket_competitions_delete on public.bracket_competitions
  for delete using (auth.uid() = created_by);

-- Participants follow competition visibility; only owner can mutate
create policy if not exists bracket_participants_select on public.bracket_participants
  for select using (
    exists(select 1 from public.bracket_competitions c where c.id = competition_id and (c.is_public or c.created_by = auth.uid()))
  );
create policy if not exists bracket_participants_mutate on public.bracket_participants
  for all using (
    exists(select 1 from public.bracket_competitions c where c.id = competition_id and c.created_by = auth.uid())
  ) with check (
    exists(select 1 from public.bracket_competitions c where c.id = competition_id and c.created_by = auth.uid())
  );

-- Matches visible if competition visible; owner can mutate
create policy if not exists bracket_matches_select on public.bracket_matches
  for select using (
    exists(select 1 from public.bracket_competitions c where c.id = competition_id and (c.is_public or c.created_by = auth.uid()))
  );
create policy if not exists bracket_matches_mutate on public.bracket_matches
  for all using (
    exists(select 1 from public.bracket_competitions c where c.id = competition_id and c.created_by = auth.uid())
  ) with check (
    exists(select 1 from public.bracket_competitions c where c.id = competition_id and c.created_by = auth.uid())
  );
