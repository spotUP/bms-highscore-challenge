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

async function checkAchievements() {
  console.log('🔍 Checking achievements in database...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

  // Check if achievements table exists and has data
  console.log('1. Checking achievements table directly...');
  const { data: achievements, error: achievementsError } = await supabase
    .from('achievements')
    .select('*')
    .limit(5);

  if (achievementsError) {
    console.error('❌ Error querying achievements:', achievementsError);
  } else {
    console.log(`✅ Found ${achievements?.length || 0} achievements`);
    if (achievements && achievements.length > 0) {
      console.log('Sample achievement:', achievements[0]);
    }
  }

  // Check the RPC function
  console.log('\n2. Testing get_tournament_achievements RPC function...');
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'get_tournament_achievements',
    { p_tournament_id: tournamentId }
  );

  if (rpcError) {
    console.error('❌ RPC Error:', rpcError);
  } else {
    console.log(`✅ RPC returned ${rpcData?.length || 0} achievements`);
    if (rpcData && rpcData.length > 0) {
      console.log('Sample RPC result:', rpcData[0]);
    }
  }

  // Check the simple version
  console.log('\n3. Testing get_tournament_achievements_simple RPC function...');
  const { data: simpleData, error: simpleError } = await supabase.rpc(
    'get_tournament_achievements_simple',
    { p_tournament_id: tournamentId }
  );

  if (simpleError) {
    console.error('❌ Simple RPC Error:', simpleError);
  } else {
    console.log(`✅ Simple RPC returned ${simpleData?.length || 0} achievements`);
    if (simpleData && simpleData.length > 0) {
      console.log('Sample Simple RPC result:', simpleData[0]);
    }
  }

  // Check achievements for any tournament
  console.log('\n4. Checking achievements without tournament filter...');
  const { data: allAchievements, error: allError } = await supabase
    .from('achievements')
    .select('id, name, description, tournament_id')
    .limit(10);

  if (allError) {
    console.error('❌ Error querying all achievements:', allError);
  } else {
    console.log(`✅ Found ${allAchievements?.length || 0} total achievements`);
    if (allAchievements && allAchievements.length > 0) {
      console.log('All achievements:');
      allAchievements.forEach(a => {
        console.log(`  - ${a.name} (tournament: ${a.tournament_id || 'global'})`);
      });
    }
  }

  console.log('\n📊 Summary:');
  console.log(`- Achievements table: ${achievements?.length || 0} records`);
  console.log(`- RPC function: ${rpcData?.length || 0} records`);
  console.log(`- Simple RPC: ${simpleData?.length || 0} records`);
  console.log(`- All achievements: ${allAchievements?.length || 0} records`);
}

checkAchievements().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});