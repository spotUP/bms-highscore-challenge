import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL');
  process.exit(1);
}

const useServiceRole = serviceRoleKey && serviceRoleKey !== '';
const key = useServiceRole ? serviceRoleKey : anonKey;

if (!key) {
  console.error('Missing both service role and anon keys');
  process.exit(1);
}

console.log(`🔑 Using ${useServiceRole ? 'SERVICE ROLE' : 'ANON'} key for real-time test`);

const supabase = createClient(supabaseUrl, key);

async function testRealtimeWithAuth() {
  console.log('🧪 Testing Real-time with Different Auth...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

  console.log('🔔 Setting up subscription...');

  // Subscribe to score submissions
  const channel = supabase
    .channel(`score_submissions_auth_test_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'score_submissions',
        filter: `tournament_id=eq.${tournamentId}`,
      },
      async (payload) => {
        console.log('\n🎉 REAL-TIME EVENT RECEIVED!');
        console.log('   Player:', payload.new?.player_name);
        console.log('   Score:', payload.new?.score);
        console.log('   Tournament ID:', payload.new?.tournament_id);
        console.log('   Timestamp:', payload.new?.created_at);
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status);
    });

  console.log('⏳ Listening for 30 seconds...');
  console.log('💡 Now submit a score or I\'ll insert a test record...\n');

  // Wait 10 seconds, then insert a test record
  setTimeout(async () => {
    console.log('🧪 Inserting test record...');

    const { error } = await supabase
      .from('score_submissions')
      .insert({
        player_name: 'AUTH_TEST',
        score: 888888,
        game_id: 'a5b413a3-c9c4-48e2-b394-e611a023bb53',
        tournament_id: tournamentId,
        is_high_score: true,
        previous_high_score: null
      });

    if (error) {
      console.error('❌ Insert error:', error);
    } else {
      console.log('✅ Test record inserted');
    }
  }, 10000);

  setTimeout(() => {
    console.log('\n⏰ Test complete');
    supabase.removeChannel(channel);
    process.exit(0);
  }, 30000);
}

testRealtimeWithAuth().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});