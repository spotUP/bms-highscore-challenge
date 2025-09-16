import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAchievements() {
  console.log('🏆 Testing achievement system...');

  try {
    // First, check if there are any achievements in the system
    console.log('📋 Checking available achievements...');
    const { data: achievements, error: achievementError } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true);

    if (achievementError) {
      console.error('❌ Error fetching achievements:', achievementError);
      return;
    }

    console.log(`✅ Found ${achievements?.length || 0} active achievements:`);
    achievements?.forEach(achievement => {
      console.log(`  - ${achievement.name}: ${achievement.description}`);
    });

    // Submit a score for a new player to test "first_score" achievement
    const testPlayerName = 'TEST' + Date.now().toString().slice(-4);
    console.log(`\n📝 Submitting first score for player: ${testPlayerName}`);

    const { data: { user } } = await supabase.auth.getUser();

    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .insert({
        player_name: testPlayerName,
        score: 50000,
        game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8',
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      })
      .select();

    if (scoreError) {
      console.error('❌ Error submitting test score:', scoreError);
      return;
    }

    console.log('✅ Test score submitted successfully');

    // Wait a moment for triggers to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if any achievements were awarded
    console.log('\n🔍 Checking for awarded achievements...');
    const { data: playerAchievements, error: paError } = await supabase
      .from('player_achievements')
      .select(`
        *,
        achievements (
          name,
          description,
          type
        )
      `)
      .eq('player_name', testPlayerName);

    if (paError) {
      console.error('❌ Error fetching player achievements:', paError);
      return;
    }

    if (playerAchievements && playerAchievements.length > 0) {
      console.log(`🎉 SUCCESS! ${playerAchievements.length} achievement(s) awarded:`);
      playerAchievements.forEach(pa => {
        console.log(`  ✨ ${pa.achievements?.name}: ${pa.achievements?.description}`);
        console.log(`     Type: ${pa.achievements?.type}, Earned: ${pa.earned_at}`);
      });
    } else {
      console.log('❌ No achievements were awarded - achievement system may not be working');
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('scores').delete().eq('player_name', testPlayerName);
    await supabase.from('player_achievements').delete().eq('player_name', testPlayerName);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testAchievements();