-- Create user favorites table
create table if not exists user_favorites (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    game_id integer not null,
    game_name text not null,
    game_description text,
    game_image_url text,
    game_platforms jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

    -- Ensure unique favorites per user per game
    unique(user_id, game_id)
);

-- Enable RLS
alter table user_favorites enable row level security;

-- Create policies
create policy "Users can view their own favorites"
    on user_favorites for select
    using (auth.uid() = user_id);

create policy "Users can insert their own favorites"
    on user_favorites for insert
    with check (auth.uid() = user_id);

create policy "Users can delete their own favorites"
    on user_favorites for delete
    using (auth.uid() = user_id);

-- Create indexes
create index user_favorites_user_id_idx on user_favorites(user_id);
create index user_favorites_game_id_idx on user_favorites(game_id);
create index user_favorites_created_at_idx on user_favorites(created_at desc);

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger update_user_favorites_updated_at
    before update on user_favorites
    for each row
    execute function update_updated_at_column();