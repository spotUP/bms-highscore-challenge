import { createClient } from '@supabase/supabase-js';

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://bdwqagbahfrfdckucbph.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkd3FhZ2JhaGZyZmRja3VjYnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQzNjM5NjIsImV4cCI6MjAzOTkzOTk2Mn0.mq3T4IHDGQEtGGlP1HfBiK2Ay7aGJNpRs6oc1LY9HKE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkClearLogosTable() {
  console.log('🔍 Checking clear_logos table...');

  try {
    // Try to select from the table
    const { data, error } = await supabase
      .from('clear_logos')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Error accessing table: ${error.message}`);
      console.log('💡 The clear_logos table may not exist or we may not have access');
      console.log('🔧 Please create the table in Supabase with the following structure:');
      console.log(`
CREATE TABLE clear_logos (
  id SERIAL PRIMARY KEY,
  launchbox_database_id INTEGER NOT NULL,
  game_name TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  logo_data TEXT NOT NULL,  -- Base64 encoded image
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL,

  -- Prevent duplicates
  UNIQUE(launchbox_database_id, region)
);

-- Create an index for faster lookups
CREATE INDEX idx_clear_logos_game_platform ON clear_logos(game_name, platform_name);
      `);
      return false;
    } else {
      console.log('✅ clear_logos table exists and is accessible');
      console.log(`📊 Current record count: ${data?.length || 0}`);
      return true;
    }
  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return false;
  }
}

async function testInsert() {
  console.log('🧪 Testing basic insert...');

  try {
    const { data, error } = await supabase
      .from('clear_logos')
      .insert({
        launchbox_database_id: 99999,
        game_name: 'Test Game',
        platform_name: 'Test Platform',
        source_url: 'https://test.com/test.png',
        logo_data: 'dGVzdA==', // base64 for "test"
        region: 'Test',
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.log(`❌ Insert failed: ${error.message}`);
      return false;
    } else {
      console.log('✅ Test insert successful');

      // Clean up test record
      await supabase
        .from('clear_logos')
        .delete()
        .eq('launchbox_database_id', 99999);

      console.log('🧹 Test record cleaned up');
      return true;
    }
  } catch (err) {
    console.error('💥 Unexpected error during insert:', err);
    return false;
  }
}

async function main() {
  const tableExists = await checkClearLogosTable();

  if (tableExists) {
    await testInsert();
  }
}

main();