#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixGamesDbSchema() {
  console.log('🔧 Fixing games_database schema...');

  const queries = [
    // Add missing columns
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS alternative_names TEXT[];`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS play_modes TEXT[];`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS themes TEXT[];`,
    `ALTER TABLE games_database ADD COLUMN IF NOT EXISTS video_urls TEXT[];`,

    // Update existing table if needed
    `ALTER TABLE games_database ALTER COLUMN genres SET DEFAULT '{}';`,
    `ALTER TABLE games_database ALTER COLUMN alternative_names SET DEFAULT '{}';`,
    `ALTER TABLE games_database ALTER COLUMN play_modes SET DEFAULT '{}';`,
    `ALTER TABLE games_database ALTER COLUMN themes SET DEFAULT '{}';`,
    `ALTER TABLE games_database ALTER COLUMN video_urls SET DEFAULT '{}';`,
  ];

  for (const query of queries) {
    try {
      console.log(`Running: ${query}`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: query });
      if (error) {
        console.log(`⚠️  ${error.message}`);
      } else {
        console.log('✅ Success');
      }
    } catch (err) {
      console.log(`⚠️  Error: ${err}`);
    }
  }

  console.log('🎉 Schema fix complete!');
}

async function main() {
  await fixGamesDbSchema();
}

main();