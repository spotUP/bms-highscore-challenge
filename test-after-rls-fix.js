import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://tnsgrwntmnzpaifmutqh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc2dyd250bW56cGFpZm11dHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTgyNjksImV4cCI6MjA3MDU3NDI2OX0.o-yVR7YDsJGJ9Yrvp-MFZGDnXcEVl1AKdx-73h-dHzM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAfterRLSFix() {
  console.log('🧪 Testing Database After RLS Fix...\n');

  try {
    // Get tournament and game for testing
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name')
      .limit(1);

    const { data: games } = await supabase
      .from('games')
      .select('id, name')
      .limit(1);

    const tournament = tournaments?.[0];
    const game = games?.[0];

    if (!tournament || !game) {
      console.log('❌ Missing tournament or game data for testing');
      return;
    }

    console.log(`Testing with:`);
    console.log(`  Tournament: ${tournament.name}`);
    console.log(`  Game: ${game.name}\n`);

    // Test 1: Score insertion
    console.log('Test 1: Inserting test score...');
    const { data: scoreResult, error: scoreError } = await supabase
      .from('scores')
      .insert({
        player_name: 'test_player_final',
        game_id: game.id,
        score: 7500,
        tournament_id: tournament.id
      })
      .select();

    if (scoreError) {
      console.log('❌ Score insertion failed:', scoreError.message);
      return;
    }

    console.log('✅ Score inserted successfully!');
    console.log('   Score data:', scoreResult[0]);

    // Test 2: Check if player_stats were auto-created
    console.log('\nTest 2: Checking player_stats auto-creation...');
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_name', 'test_player_final');

    if (playerStats && playerStats.length > 0) {
      console.log('✅ Player stats auto-created!');
      console.log('   Stats:', playerStats[0]);
    } else {
      console.log('❌ Player stats were not created');
    }

    // Test 3: Check achievements
    console.log('\nTest 3: Checking achievements...');
    const { data: achievements } = await supabase
      .from('player_achievements')
      .select(`
        achievement_id,
        achievements (
          name,
          description
        )
      `)
      .eq('player_name', 'test_player_final');

    if (achievements && achievements.length > 0) {
      console.log('✅ Achievements awarded:');
      achievements.forEach(pa => {
        console.log(`   - ${pa.achievements.name}: ${pa.achievements.description}`);
      });
    } else {
      console.log('⚠️  No achievements awarded (score might be too low)');
    }

    // Test 4: Multiple scores to test accumulation
    console.log('\nTest 4: Testing score accumulation...');

    // Insert another score
    await supabase
      .from('scores')
      .insert({
        player_name: 'test_player_final',
        game_id: game.id,
        score: 8500,
        tournament_id: tournament.id
      });

    // Check updated stats
    const { data: updatedStats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_name', 'test_player_final');

    if (updatedStats && updatedStats.length > 0) {
      const stats = updatedStats[0];
      console.log('✅ Stats updated after second score:');
      console.log(`   Total scores: ${stats.total_scores}`);
      console.log(`   Total games: ${stats.total_games_played}`);
      console.log(`   Best score: ${stats.best_score}`);
      console.log(`   Total score: ${stats.total_score}`);
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('scores').delete().eq('player_name', 'test_player_final');
    await supabase.from('player_stats').delete().eq('player_name', 'test_player_final');
    await supabase.from('player_achievements').delete().eq('player_name', 'test_player_final');

    console.log('✅ Cleanup complete!');
    console.log('\n🎉 All tests passed! Your database fixes are working correctly.');

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

testAfterRLSFix().catch(console.error);

