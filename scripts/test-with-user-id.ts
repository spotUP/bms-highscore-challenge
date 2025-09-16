import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testWithUserId() {
  console.log('🧪 Testing score submission with user_id...');

  try {
    // Get current user (if authenticated)
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user?.id || 'anonymous');

    const gameId = '95caf0d5-f28f-4dc0-b56d-695adf0aadc8';
    const tournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

    // Test with user_id included
    console.log('📝 Testing with user_id included...');
    const { data, error } = await supabase
      .from('scores')
      .insert({
        player_name: 'UI',
        score: 999,
        game_id: gameId,
        tournament_id: tournamentId,
        user_id: user?.id || null
      })
      .select();

    if (error) {
      console.error('❌ Still failing with user_id:', error);
    } else {
      console.log('✅ Success with user_id!', data);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testWithUserId();