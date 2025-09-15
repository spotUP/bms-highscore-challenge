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

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function clearProgressWithServiceKey() {
  console.log('🧪 Clearing progress with service role key...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

  // Count records before
  const { data: beforeCount, error: beforeError } = await supabase
    .from('player_achievements')
    .select('id')
    .eq('tournament_id', tournamentId);

  console.log(`📊 Records before delete: ${beforeCount?.length || 0}`);

  // Attempt the delete operation with service role
  console.log('\n🗑️ Attempting delete operation with service role...');
  const { error } = await supabase
    .from('player_achievements')
    .delete()
    .eq('tournament_id', tournamentId);

  if (error) {
    console.error('❌ Delete failed:', error);
  } else {
    console.log('✅ Delete operation succeeded');
  }

  // Count records after
  const { data: afterCount, error: afterError } = await supabase
    .from('player_achievements')
    .select('id')
    .eq('tournament_id', tournamentId);

  console.log(`📊 Records after delete: ${afterCount?.length || 0}`);

  if ((beforeCount?.length || 0) > (afterCount?.length || 0)) {
    console.log(`🎉 Successfully deleted ${(beforeCount?.length || 0) - (afterCount?.length || 0)} records`);
  } else {
    console.log('⚠️  No records were deleted - RLS policies may be blocking');
  }
}

clearProgressWithServiceKey().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});