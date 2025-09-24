-- Fix user_favorites table schema to use INTEGER game_id instead of UUID

-- Drop existing table (this will lose existing favorites)
DROP TABLE IF EXISTS user_favorites CASCADE;

-- Create new table with correct schema
CREATE TABLE user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_id INTEGER NOT NULL, -- Changed from UUID to INTEGER to match games_database.id
  game_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure a user can only favorite a game once
  UNIQUE(user_id, game_id)
);

-- Enable RLS on user_favorites table
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own favorites
CREATE POLICY "user_favorites_select_own"
ON user_favorites FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert their own favorites
CREATE POLICY "user_favorites_insert_own"
ON user_favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own favorites
CREATE POLICY "user_favorites_delete_own"
ON user_favorites FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_game_id ON user_favorites(game_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_game ON user_favorites(user_id, game_id);