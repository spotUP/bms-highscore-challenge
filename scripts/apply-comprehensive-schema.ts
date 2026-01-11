#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function applySchemaChanges() {
  console.log('🔧 Applying comprehensive metadata schema changes...\n');

  try {
    // Add all the missing columns
    const alterCommands = [
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS video_url TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS release_year INTEGER',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS overview TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS max_players INTEGER',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS cooperative BOOLEAN',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS community_rating NUMERIC(5,2)',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS community_rating_count INTEGER',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS esrb_rating TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS genres TEXT[]',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS developer TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS publisher TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS screenshot_url TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS cover_url TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS logo_url TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS series TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS region TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS alternative_names TEXT[]',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS play_modes TEXT[]',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS themes TEXT[]',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS wikipedia_url TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS video_urls TEXT[]',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS release_type TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS release_date TEXT',
      'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS database_id INTEGER'
    ];

    console.log('📋 Adding metadata columns...');
    for (const [index, command] of alterCommands.entries()) {
      console.log(`  ${index + 1}/${alterCommands.length}: ${command.split(' ')[6]} column...`);
      const { error } = await supabase.rpc('execute_sql', { sql: command });

      if (error) {
        console.error(`❌ Error executing: ${command}`);
        console.error(`   ${error.message}`);
      } else {
        console.log(`✅ Success`);
      }
    }

    // Create indexes for performance
    console.log('\n📇 Creating performance indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_games_database_video_url ON games_database(video_url)',
      'CREATE INDEX IF NOT EXISTS idx_games_database_release_year ON games_database(release_year)',
      'CREATE INDEX IF NOT EXISTS idx_games_database_developer ON games_database(developer)',
      'CREATE INDEX IF NOT EXISTS idx_games_database_publisher ON games_database(publisher)',
      'CREATE INDEX IF NOT EXISTS idx_games_database_esrb_rating ON games_database(esrb_rating)',
      'CREATE INDEX IF NOT EXISTS idx_games_database_community_rating ON games_database(community_rating)',
      'CREATE INDEX IF NOT EXISTS idx_games_database_genres ON games_database USING GIN(genres)'
    ];

    for (const [index, indexCmd] of indexes.entries()) {
      console.log(`  ${index + 1}/${indexes.length}: Creating index...`);
      const { error } = await supabase.rpc('execute_sql', { sql: indexCmd });

      if (error) {
        console.error(`❌ Error creating index: ${error.message}`);
      } else {
        console.log(`✅ Index created`);
      }
    }

    // Update database_id to match id for compatibility
    console.log('\n🔄 Updating database_id for compatibility...');
    const { error: updateError } = await supabase.rpc('execute_sql', {
      sql: 'UPDATE games_database SET database_id = id WHERE database_id IS NULL'
    });

    if (updateError) {
      console.error(`❌ Error updating database_id: ${updateError.message}`);
    } else {
      console.log(`✅ database_id updated successfully`);
    }

    console.log('\n✅ Schema migration completed successfully!');
    console.log('🎬 The database now supports comprehensive game metadata including video URLs!');

  } catch (error) {
    console.error('❌ Schema migration failed:', error);
    process.exit(1);
  }
}

applySchemaChanges().then(() => process.exit(0));