import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

// Use the same client setup as the UI
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUIScoreSubmission() {
  console.log('🧪 Testing score submission as the UI would...');

  try {
    // First, check if we can read scores
    console.log('📖 Testing read access to scores...');
    const { data: readData, error: readError } = await supabase
      .from('scores')
      .select('*')
      .limit(5);

    if (readError) {
      console.error('❌ Cannot read scores:', readError);
      return;
    }

    console.log('✅ Can read scores. Found:', readData?.length || 0);

    // Test game access
    console.log('🎮 Testing read access to games...');
    const { data: games, error: gameError } = await supabase
      .from('games')
      .select('*')
      .limit(1);

    if (gameError) {
      console.error('❌ Cannot read games:', gameError);
      return;
    }

    if (!games || games.length === 0) {
      console.error('❌ No games found');
      return;
    }

    const gameId = games[0].id;
    console.log('✅ Found game:', games[0].name, 'ID:', gameId);

    // Get current user for user_id field
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 Current user:', user?.id || 'anonymous');

    // Test score submission with user_id included
    console.log('📝 Testing score submission...');
    const { data, error } = await supabase
      .from('scores')
      .insert({
        player_name: 'UI',
        score: 999,
        game_id: gameId,
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      })
      .select();

    if (error) {
      console.error('❌ Score submission failed:', error);
      console.log('Error code:', error.code);
      console.log('Error message:', error.message);
      console.log('Error details:', error.details);
    } else {
      console.log('✅ Score submission successful!', data);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testUIScoreSubmission();