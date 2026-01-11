#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fixUserFavoritesSchema() {
  console.log('🔧 Fixing user_favorites table schema...');

  try {
    // We need to alter the table to change game_id from UUID to INTEGER
    // This is a bit tricky with existing data, so let's drop and recreate

    const fixSQL = `
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
    `;

    console.log('⚠️  This will drop existing favorites and recreate the table with the correct schema');
    console.log('🚀 Applying schema fix...');

    // We can't execute raw SQL through the REST API directly, so let's try using rpc
    // First, let's try a simple approach - just try to insert a test record and see what happens

    console.log('🧪 Testing current schema...');
    const testResult = await supabase
      .from('user_favorites')
      .insert({
        user_id: '0f0672de-6b1a-49e1-8857-41fef18dc6f8',
        game_id: 163341, // Integer ID
        game_name: 'Test Game'
      });

    if (testResult.error) {
      console.log('❌ Current schema has issues:', testResult.error.message);
      console.log('📋 You need to manually execute this SQL in Supabase Dashboard:');
      console.log(fixSQL);
    } else {
      console.log('✅ Schema appears to be working! Cleaning up test record...');
      await supabase
        .from('user_favorites')
        .delete()
        .eq('game_name', 'Test Game');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixUserFavoritesSchema().then(() => process.exit(0));