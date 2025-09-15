import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables exactly like the browser app
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Use ANON key like browser

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

console.log('🔑 Using ANON key (like browser app)');
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBrowserStyleRealtime() {
  console.log('🧪 Testing Browser-Style Real-time Connection...\n');

  const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

  console.log('🔔 Setting up subscription EXACTLY like ScoreNotificationsListener...');

  // Use EXACT same channel naming pattern as ScoreNotificationsListener
  const channelName = `score_submissions_${tournamentId}_${Date.now()}`;
  console.log('📡 Channel name:', channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'score_submissions',
        filter: `tournament_id=eq.${tournamentId}`,
      },
      async (payload) => {
        console.log('\n🎉 BROWSER-STYLE EVENT RECEIVED!');
        console.log('   Player:', payload.new?.player_name);
        console.log('   Score:', payload.new?.score);
        console.log('   Tournament ID:', payload.new?.tournament_id);
        console.log('   Timestamp:', payload.new?.created_at);
        console.log('   Full payload:', JSON.stringify(payload, null, 2));

        // Simulate the game lookup exactly like ScoreNotificationsListener
        console.log('\n🎮 Looking up game info...');
        const { data: game, error: gameError } = await supabase
          .from('games')
          .select('name, logo_url')
          .eq('id', payload.new?.game_id)
          .single();

        if (gameError) {
          console.error('❌ Game lookup error:', gameError);
        } else {
          console.log('✅ Game found:', game);
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed with ANON key!');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error with ANON key!');
      }
    });

  console.log('⏳ Listening for 30 seconds with ANON key...');
  console.log('💡 Will insert test record in 10 seconds...\n');

  // Insert test record after 10 seconds
  setTimeout(async () => {
    console.log('🧪 Inserting test record with ANON key...');

    const { error } = await supabase
      .from('score_submissions')
      .insert({
        player_name: 'BROWSER_TEST',
        score: 777777,
        game_id: 'a5b413a3-c9c4-48e2-b394-e611a023bb53',
        tournament_id: tournamentId,
        is_high_score: true,
        previous_high_score: null
      });

    if (error) {
      console.error('❌ Insert error with ANON key:', error);
    } else {
      console.log('✅ Test record inserted with ANON key');
    }
  }, 10000);

  setTimeout(() => {
    console.log('\n⏰ Browser-style test complete');
    supabase.removeChannel(channel);
    process.exit(0);
  }, 30000);
}

testBrowserStyleRealtime().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});