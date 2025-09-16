import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMobileAndLeaderboards() {
  console.log('🧪 Testing Mobile/QR Submission and Leaderboard Data...\n');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: games } = await supabase.from('games').select('*');

    if (!games || games.length === 0) {
      throw new Error('No games available for testing');
    }

    // Test 1: Mobile/QR Submission
    console.log('📱 Testing Mobile/QR Submission...');
    const mobilePlayerName = 'MOBL' + Date.now().toString().slice(-4);
    const mobileScore = 65000;

    const { data: mobileData, error: mobileError } = await supabase
      .from('scores')
      .insert({
        player_name: mobilePlayerName,
        score: mobileScore,
        game_id: games[0].id,
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      })
      .select();

    if (mobileError) {
      console.log('❌ Mobile submission failed:', mobileError.message);
    } else {
      console.log('✅ Mobile submission successful');
      console.log(`   Player: ${mobilePlayerName}, Score: ${mobileScore}`);
      console.log(`   user_id included: ${!!(mobileData?.[0]?.user_id !== undefined)}`);
    }

    // Check realtime notification
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { data: submission } = await supabase
      .from('score_submissions')
      .select('*')
      .eq('player_name', mobilePlayerName)
      .order('created_at', { ascending: false })
      .limit(1);

    console.log(`   Realtime notification created: ${submission && submission.length > 0}`);

    // Test 2: Leaderboard Data
    console.log('\n📊 Testing Leaderboard Data Aggregation...');

    const testPlayers = [
      { name: 'LEAD' + Date.now().toString().slice(-4), score: 90000 },
      { name: 'LEAD' + (Date.now() + 1).toString().slice(-4), score: 85000 },
      { name: 'LEAD' + (Date.now() + 2).toString().slice(-4), score: 80000 }
    ];

    console.log('   Creating test players with scores...');
    const insertedScores = [];
    for (const player of testPlayers) {
      for (let i = 0; i < Math.min(2, games.length); i++) {
        const { data } = await supabase
          .from('scores')
          .insert({
            player_name: player.name,
            score: player.score + (i * 1000),
            game_id: games[i].id,
            tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
            user_id: user?.id || null
          })
          .select();
        if (data) insertedScores.push(...data);
      }
    }
    console.log(`   Inserted ${insertedScores.length} scores for ${testPlayers.length} players`);

    // Wait for views to update
    console.log('   Waiting for views to update...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check achievement data (calculated client-side in the app)
    const { data: playerAchievements, error: ahError } = await supabase
      .from('player_achievements')
      .select('*, achievements(name, points)')
      .in('player_name', testPlayers.map(p => p.name));

    if (ahError) {
      console.log('❌ Achievement data error:', ahError.message);
    } else {
      console.log(`✅ Achievement data: ${playerAchievements?.length || 0} achievements found`);
    }

    // Check score data for leaderboard calculation
    const { data: allScores, error: olError } = await supabase
      .from('scores')
      .select('*')
      .in('player_name', testPlayers.map(p => p.name));

    if (olError) {
      console.log('❌ Score data error:', olError.message);
    } else {
      console.log(`✅ Score data: ${allScores?.length || 0} scores found`);

      // Calculate leaderboard like the app does
      const leaderboard = testPlayers.map(p => {
        const playerScores = allScores?.filter(s => s.player_name === p.name) || [];
        return {
          player_name: p.name,
          total_score: playerScores.reduce((sum, s) => sum + s.score, 0),
          game_count: playerScores.length
        };
      }).sort((a, b) => b.total_score - a.total_score);

      console.log('   Calculated leaderboard:');
      leaderboard.forEach((leader, idx) => {
        console.log(`     ${idx + 1}. ${leader.player_name}: ${leader.total_score} points (${leader.game_count} games)`);
      });
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');

    // Clean up mobile test
    await supabase.from('scores').delete().eq('player_name', mobilePlayerName);
    await supabase.from('player_achievements').delete().eq('player_name', mobilePlayerName);
    if (submission && submission.length > 0) {
      await supabase.from('score_submissions').delete().eq('id', submission[0].id);
    }

    // Clean up leaderboard test
    for (const player of testPlayers) {
      await supabase.from('scores').delete().eq('player_name', player.name);
      await supabase.from('player_achievements').delete().eq('player_name', player.name);
    }

    console.log('✅ Test data cleaned up');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

testMobileAndLeaderboards();