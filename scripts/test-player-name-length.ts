import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPlayerNameLength() {
  console.log('📏 Testing player name length limits...');

  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Test 16 character name (should work)
    const name16 = '1234567890123456';
    console.log(`\nTesting 16 chars: "${name16}" (length: ${name16.length})`);

    const { data: data16, error: error16 } = await supabase
      .from('scores')
      .insert({
        player_name: name16,
        score: 100,
        game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8',
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      })
      .select();

    if (error16) {
      console.log('❌ 16 chars failed:', error16.message);
    } else {
      console.log('✅ 16 chars worked!');
      // Clean up
      await supabase.from('scores').delete().eq('player_name', name16);
      await supabase.from('player_achievements').delete().eq('player_name', name16);
    }

    // Test 17 character name (should fail)
    const name17 = '12345678901234567';
    console.log(`\nTesting 17 chars: "${name17}" (length: ${name17.length})`);

    const { data: data17, error: error17 } = await supabase
      .from('scores')
      .insert({
        player_name: name17,
        score: 100,
        game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8',
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      })
      .select();

    if (error17) {
      console.log('✅ 17 chars correctly rejected:', error17.message);
    } else {
      console.log('❌ 17 chars incorrectly accepted!');
      // Clean up if it somehow worked
      await supabase.from('scores').delete().eq('player_name', name17);
      await supabase.from('player_achievements').delete().eq('player_name', name17);
    }

    // Test exactly at the limit
    const name3 = 'ABC';
    console.log(`\nTesting 3 chars: "${name3}" (length: ${name3.length})`);

    const { data: data3, error: error3 } = await supabase
      .from('scores')
      .insert({
        player_name: name3,
        score: 100,
        game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8',
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      })
      .select();

    if (error3) {
      console.log('❌ 3 chars failed:', error3.message);
    } else {
      console.log('✅ 3 chars worked!');
      // Clean up
      await supabase.from('scores').delete().eq('player_name', name3);
      await supabase.from('player_achievements').delete().eq('player_name', name3);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testPlayerNameLength();