#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createUserFavoritesTable() {
  console.log('🔄 Ensuring user_favorites table exists...');

  try {
    // First check if table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('user_favorites')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ user_favorites table already exists');
      return;
    }

    console.log('📋 Table does not exist, creating user_favorites table...');

    // Create the table using raw SQL
    const createTableSQL = `
      -- Create user_favorites table for storing user's favorite games
      CREATE TABLE IF NOT EXISTS user_favorites (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
        game_id TEXT NOT NULL, -- Game ID from games_database table
        game_name TEXT NOT NULL, -- Game name for easier querying
        created_at TIMESTAMPTZ DEFAULT NOW(),

        -- Ensure a user can only favorite a game once
        UNIQUE(user_id, game_id)
      );

      -- Enable RLS on user_favorites table
      ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "user_favorites_select_own" ON user_favorites;
      DROP POLICY IF EXISTS "user_favorites_insert_own" ON user_favorites;
      DROP POLICY IF EXISTS "user_favorites_delete_own" ON user_favorites;

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
    `;

    // Execute the SQL using the REST API
    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (error) {
      // If exec_sql doesn't exist, we need to use a different approach
      console.log('⚠️  Cannot execute SQL directly. Table might not exist.');
      console.log('🔧 You may need to manually create the user_favorites table in Supabase dashboard');
      console.log('📋 SQL to create the table:');
      console.log(createTableSQL);
      return;
    }

    console.log('✅ user_favorites table created successfully');

  } catch (error) {
    console.error('❌ Error creating user_favorites table:', error);
  }
}

// Run the script
createUserFavoritesTable().then(() => process.exit(0));