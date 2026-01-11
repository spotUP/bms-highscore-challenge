#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSchemaUpdate() {
  console.log('🔧 Testing simple schema update for video_url column...\n');

  try {
    // First test if video_url column exists by trying to select it
    console.log('🔍 Testing current schema...');
    const { data: testData, error: testError } = await supabase
      .from('games_database')
      .select('video_url')
      .limit(1);

    if (testError) {
      console.log('❌ video_url column does not exist - this confirms we need the schema update');
      console.log('Error:', testError.message);
    } else {
      console.log('✅ video_url column already exists!');
      console.log('Sample data:', testData);
    }

    // Now let's test if we can update a row to add a video_url value manually
    console.log('\n🧪 Testing if we can manually update video_url via Supabase...');

    // Try to update one record to test the schema
    const { data: updateData, error: updateError } = await supabase
      .from('games_database')
      .update({
        logo_base64: { test_video_url: 'https://www.youtube.com/watch?v=test123' }
      })
      .eq('name', 'Pac-Man')
      .select()
      .limit(1);

    if (updateError) {
      console.log('❌ Error updating record:', updateError.message);
    } else {
      console.log('✅ Successfully updated a test record');
      console.log('Updated data:', updateData);
    }

    console.log('\n💡 Next step: We need to use SQL migration files instead of direct API calls for schema changes.');
    console.log('💡 The video_url and other metadata columns need to be added via database migration.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSchemaUpdate().then(() => process.exit(0));