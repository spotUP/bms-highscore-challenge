import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testRealAchievement() {
  console.log('🎯 Testing real achievement triggering...\n');

  try {
    const testPlayer = 'REAL_TEST_' + Math.random().toString(36).substring(7);

    console.log('1. Testing score insertion that should trigger achievements...');

    // Try to insert a score the way the real app does
    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .insert({
        player_name: testPlayer,
        score: 25000,
        game_id: 1 // Assuming first game
      })
      .select()
      .single();

    if (scoreError) {
      console.log('❌ Error inserting score:', scoreError);
      return;
    }

    console.log('✅ Score inserted successfully:', scoreData);

    // Wait a moment for triggers to execute
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if achievements were awarded
    console.log('\n2. Checking for awarded achievements...');
    const { data: achievements, error: achError } = await supabase
      .from('player_achievements')
      .select(`
        *,
        achievements (
          name,
          description
        )
      `)
      .eq('player_name', testPlayer);

    if (achError) {
      console.log('❌ Error checking achievements:', achError);
    } else if (achievements && achievements.length > 0) {
      console.log('✅ Found achievements:');
      achievements.forEach(ach => {
        console.log(`   🏆 ${ach.achievements?.name}: ${ach.achievements?.description}`);
        console.log(`      Earned: ${ach.earned_at}`);
      });
    } else {
      console.log('❌ No achievements found - this indicates the trigger is not working');
    }

    // Let's also check the scores table to see what columns are actually available
    console.log('\n3. Checking what we actually inserted...');
    const { data: insertedScore, error: fetchError } = await supabase
      .from('scores')
      .select('*')
      .eq('player_name', testPlayer)
      .single();

    if (fetchError) {
      console.log('❌ Error fetching score:', fetchError);
    } else {
      console.log('✅ Inserted score details:', insertedScore);
    }

    // Clean up
    console.log('\n4. Cleaning up test data...');
    await supabase.from('player_achievements').delete().eq('player_name', testPlayer);
    await supabase.from('scores').delete().eq('player_name', testPlayer);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealAchievement().catch(console.error);