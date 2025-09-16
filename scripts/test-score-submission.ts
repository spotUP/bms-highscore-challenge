import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testScoreSubmission() {
  console.log('🎮 Testing score submission functionality...');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: games } = await supabase.from('games').select('*').limit(1);

    if (!games || games.length === 0) {
      throw new Error('No games available for testing');
    }

    const game = games[0];
    const testPlayerName = 'SUBM' + Date.now().toString().slice(-4);
    const testScore = 75000;

    console.log(`\n📝 Submitting score for player: ${testPlayerName}`);
    console.log(`Score: ${testScore}, Game: ${game.name}`);

    // Test score submission with user_id
    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .insert({
        player_name: testPlayerName,
        score: testScore,
        game_id: game.id,
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      })
      .select();

    if (scoreError) {
      console.log('❌ Score submission failed:', scoreError.message);
      return;
    }

    console.log('✅ Score submitted successfully!');
    console.log('user_id included:', !!(scoreData?.[0]?.user_id !== undefined));

    // Wait for triggers to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if score was inserted
    const { data: insertedScore } = await supabase
      .from('scores')
      .select('*')
      .eq('player_name', testPlayerName)
      .single();

    if (insertedScore) {
      console.log('✅ Score found in database');
      console.log(`Player: ${insertedScore.player_name}, Score: ${insertedScore.score}`);
    } else {
      console.log('❌ Score not found in database');
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('scores').delete().eq('player_name', testPlayerName);
    await supabase.from('player_achievements').delete().eq('player_name', testPlayerName);
    console.log('✅ Test data cleaned up');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

testScoreSubmission();