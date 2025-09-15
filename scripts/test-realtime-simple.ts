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

async function testRealtimeSimple() {
  console.log('🧪 Testing Real-time Subscription (Simple)...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d'; // From debug output

  console.log('🔔 Setting up subscription for tournament:', tournamentId);

  // Subscribe exactly like the app does
  const channel = supabase
    .channel(`score_submissions_${tournamentId}_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'score_submissions',
        filter: `tournament_id=eq.${tournamentId}`,
      },
      async (payload) => {
        console.log('🎉 REAL-TIME EVENT RECEIVED!');
        console.log('   Player:', payload.new?.player_name);
        console.log('   Score:', payload.new?.score);
        console.log('   Game ID:', payload.new?.game_id);
        console.log('   Tournament ID:', payload.new?.tournament_id);
        console.log('   High Score:', payload.new?.is_high_score);
        console.log('   Raw payload:', payload);

        // Test if we can fetch game info like the app does
        const { data: game, error: gameError } = await supabase
          .from('games')
          .select('name, logo_url')
          .eq('id', payload.new?.game_id)
          .single();

        if (gameError) {
          console.log('   ❌ Game fetch error:', gameError);
        } else {
          console.log('   ✅ Game found:', game.name);
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status);
    });

  console.log('⏳ Listening for 60 seconds...');
  console.log('💡 Submit a score from your phone now!');

  setTimeout(() => {
    console.log('\n⏰ Test complete. Cleaning up...');
    supabase.removeChannel(channel);
    process.exit(0);
  }, 60000);
}

testRealtimeSimple().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});