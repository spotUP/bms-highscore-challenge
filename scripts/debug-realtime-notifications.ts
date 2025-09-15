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

async function debugRealtimeNotifications() {
  console.log('🔍 Debugging Real-time Score Notifications...\n');

  try {
    // 1. Check recent score submissions
    console.log('📋 Checking recent score submissions...');
    const { data: submissions, error: submissionsError } = await supabase
      .from('score_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (submissionsError) {
      console.error('❌ Error fetching score submissions:', submissionsError);
    } else {
      console.log(`✅ Found ${submissions?.length || 0} recent score submissions`);
      if (submissions && submissions.length > 0) {
        console.log('📄 Most recent submission:');
        console.log('   Player:', submissions[0].player_name);
        console.log('   Score:', submissions[0].score);
        console.log('   Game ID:', submissions[0].game_id);
        console.log('   Tournament ID:', submissions[0].tournament_id);
        console.log('   Created:', submissions[0].created_at);
        console.log('   High Score:', submissions[0].is_high_score);
      }
    }

    // 2. Check current tournament
    console.log('\n🏆 Checking current tournament...');
    const { data: tournaments, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (tournamentError) {
      console.error('❌ Error fetching tournaments:', tournamentError);
    } else {
      console.log(`✅ Found ${tournaments?.length || 0} tournaments`);
      if (tournaments && tournaments.length > 0) {
        console.log('📄 Most recent tournament:');
        console.log('   ID:', tournaments[0].id);
        console.log('   Name:', tournaments[0].name);
        console.log('   Active:', tournaments[0].is_active);
      }
    }

    // 3. Test real-time subscription
    console.log('\n🔔 Testing real-time subscription...');

    // Subscribe to score submissions
    const channel = supabase
      .channel(`test_score_submissions_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'score_submissions',
        },
        (payload) => {
          console.log('🎉 Real-time event received!', {
            player: payload.new?.player_name,
            score: payload.new?.score,
            tournament_id: payload.new?.tournament_id,
            timestamp: payload.new?.created_at
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    console.log('⏳ Listening for real-time events for 30 seconds...');
    console.log('💡 Try submitting a score from your phone to test!');

    // Wait 30 seconds
    setTimeout(() => {
      console.log('\n⏰ Test period ended. Cleaning up...');
      supabase.removeChannel(channel);

      console.log('\n📊 Debug Summary:');
      console.log('1. Check if score submissions are being recorded');
      console.log('2. Verify tournament IDs match between submissions and current tournament');
      console.log('3. Ensure real-time subscription is working');

      process.exit(0);
    }, 30000);

  } catch (error) {
    console.error('❌ Error during debugging:', error);
    process.exit(1);
  }
}

debugRealtimeNotifications().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});