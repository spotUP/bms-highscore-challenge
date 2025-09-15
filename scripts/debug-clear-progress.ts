import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugClearProgress() {
  console.log('🔍 Debugging Clear All Progress function...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

  // Check the structure of player_achievements table
  console.log('1. Checking player_achievements table structure:');
  const { data: playerAchievements, error: playerError } = await supabase
    .from('player_achievements')
    .select('*')
    .limit(3);

  if (playerError) {
    console.error('❌ Error:', playerError);
  } else {
    console.log('✅ Sample player_achievements records:');
    playerAchievements?.forEach(pa => {
      console.log('   Record:', pa);
    });
  }

  // Test the delete operation we're trying to do
  console.log('\n2. Testing delete operation (DRY RUN):');
  const { data: toDelete, error: selectError } = await supabase
    .from('player_achievements')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (selectError) {
    console.error('❌ Select Error:', selectError);
  } else {
    console.log(`✅ Found ${toDelete?.length || 0} records that would be deleted with tournament_id = ${tournamentId}`);
  }

  // Check if tournament_id column exists and has values
  console.log('\n3. Checking tournament_id values:');
  const { data: tournamentCheck, error: tournamentError } = await supabase
    .from('player_achievements')
    .select('id, tournament_id')
    .limit(10);

  if (tournamentError) {
    console.error('❌ Error:', tournamentError);
  } else {
    console.log('✅ Tournament ID distribution:');
    const tournamentCounts = tournamentCheck?.reduce((acc, record) => {
      const tid = record.tournament_id || 'null';
      acc[tid] = (acc[tid] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    Object.entries(tournamentCounts).forEach(([tid, count]) => {
      console.log(`   ${tid}: ${count} records`);
    });
  }

  console.log('\n📊 Analysis:');
  if ((toDelete?.length || 0) === 0) {
    console.log('❌ No records found with the specified tournament_id');
    console.log('   This is why the delete operation had no effect');
    console.log('   The player_achievements might not have tournament_id set properly');
  } else {
    console.log('✅ Records found - delete should work');
  }
}

debugClearProgress().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});