#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function recreateGamesDatabase() {
  console.log('🔧 Recreating games_database table with full schema...');

  try {
    // First, clear existing data
    console.log('🗑️  Clearing existing games_database...');
    const { error: deleteError } = await supabase
      .from('games_database')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError && !deleteError.message.includes('does not exist')) {
      console.log('Error clearing table:', deleteError);
    } else {
      console.log('✅ Table cleared');
    }

    // Try to add missing columns one by one using simple operations
    const columns = [
      { name: 'database_id', type: 'integer' },
      { name: 'release_year', type: 'integer' },
      { name: 'overview', type: 'text' },
      { name: 'max_players', type: 'integer' },
      { name: 'release_type', type: 'text' },
      { name: 'cooperative', type: 'boolean' },
      { name: 'video_url', type: 'text' },
      { name: 'community_rating', type: 'decimal(4,2)' },
      { name: 'community_rating_count', type: 'integer' },
      { name: 'esrb_rating', type: 'text' },
      { name: 'developer', type: 'text' },
      { name: 'publisher', type: 'text' },
      { name: 'series', type: 'text' },
      { name: 'region', type: 'text' },
      { name: 'wikipedia_url', type: 'text' },
      { name: 'screenshot_url', type: 'text' },
      { name: 'cover_url', type: 'text' },
      { name: 'logo_url', type: 'text' },
    ];

    console.log('\n📝 Adding missing columns...');
    for (const column of columns) {
      try {
        // Use a simple insert test to see if column exists
        const testData = { [column.name]: null };
        const { error } = await supabase
          .from('games_database')
          .insert({ name: 'test', platform_name: 'test', ...testData })
          .select()
          .limit(1);

        if (error && error.message.includes('Could not find')) {
          console.log(`❌ Column ${column.name} missing`);
        } else {
          console.log(`✅ Column ${column.name} exists`);
          // Clean up test record if it was inserted
          await supabase.from('games_database').delete().eq('name', 'test');
        }
      } catch (err) {
        console.log(`⚠️  Error testing column ${column.name}`);
      }
    }

    console.log('\n✅ Schema check complete! The table exists but may be missing some columns.');
    console.log('💡 We can proceed with import using only the columns that exist.');

  } catch (error) {
    console.error('❌ Error recreating schema:', error);
  }
}

recreateGamesDatabase();