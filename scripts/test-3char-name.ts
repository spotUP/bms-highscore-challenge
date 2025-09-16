import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function test3CharName() {
  console.log('🧪 Testing 3-character name submission...');

  try {
    const testGameId = '95caf0d5-f28f-4dc0-b56d-695adf0aadc8'; // From debug output
    const testTournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d'; // From debug output

    const { data, error } = await adminClient
      .from('scores')
      .insert({
        player_name: 'TST', // 3 characters
        score: 9999,
        game_id: testGameId,
        tournament_id: testTournamentId
      })
      .select();

    if (error) {
      console.error('❌ Still failing with 3-char name:', error);
    } else {
      console.log('✅ Success with 3-char name! Inserted:', data);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

test3CharName();