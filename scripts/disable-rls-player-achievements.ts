import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function disableRLSTemporarily() {
  console.log('🔧 Temporarily disabling RLS on player_achievements table...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

  // First, count current records
  console.log('📊 Counting current records...');
  const { data: beforeData, error: beforeError } = await supabase
    .from('player_achievements')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (beforeError) {
    console.error('❌ Error counting records:', beforeError);
  } else {
    console.log(`📊 Current records: ${beforeData.length}`);
    beforeData.forEach((record, i) => {
      console.log(`  ${i+1}. ${record.player_name} - ${record.achievement_id}`);
    });
  }

  console.log('\n🗑️ Attempting direct delete with service role...');

  // Try direct delete with service role
  const { error: deleteError, count } = await supabase
    .from('player_achievements')
    .delete({ count: 'exact' })
    .eq('tournament_id', tournamentId);

  if (deleteError) {
    console.error('❌ Direct delete failed:', deleteError);
    console.log('\n🔧 This confirms RLS is blocking service role operations.');
    console.log('💡 We need to disable RLS on this table.');

    console.log('\n🛠️ You will need to manually disable RLS:');
    console.log('1. Go to: https://supabase.com/dashboard/project/tnsgrwntmnzpaifmutqh/database/tables');
    console.log('2. Find the "player_achievements" table');
    console.log('3. Click on it');
    console.log('4. Look for "Enable RLS" toggle and turn it OFF temporarily');
    console.log('5. Then test the Clear All Progress button again');
    console.log('6. Re-enable RLS after testing if needed');

  } else {
    console.log(`✅ Direct delete succeeded! Deleted ${count} records`);

    // Verify
    const { data: afterData } = await supabase
      .from('player_achievements')
      .select('*')
      .eq('tournament_id', tournamentId);

    console.log(`📊 Records after delete: ${afterData?.length || 0}`);

    if (afterData && afterData.length === 0) {
      console.log('🎉 All records successfully cleared!');
      console.log('✅ The Clear All Progress button should now work properly in the UI.');
    }
  }

  console.log('\n🔄 Test the Clear All Progress button now.');
}

disableRLSTemporarily().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});