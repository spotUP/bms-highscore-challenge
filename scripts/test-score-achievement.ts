import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testScoreAchievement() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🎯 Testing achievement awarding by submitting a test score...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get tournament and game info
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name')
      .limit(1);

    if (!tournaments || tournaments.length === 0) {
      console.error('❌ No tournaments found');
      return;
    }

    const tournamentId = tournaments[0].id;
    console.log(`🏆 Using tournament: ${tournaments[0].name}`);

    // Get a game to submit score to
    const { data: games } = await supabase
      .from('games')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .limit(1);

    if (!games || games.length === 0) {
      console.error('❌ No games found in tournament');
      return;
    }

    const gameId = games[0].id;
    console.log(`🎮 Using game: ${games[0].name}`);

    const testPlayerName = 'ACH';
    const testScore = 150; // Should trigger "First Score" and "Century Club" achievements

    console.log(`\n🎯 Submitting test score: ${testScore} points for player ${testPlayerName}`);

    // Insert test score
    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .insert({
        player_name: testPlayerName,
        score: testScore,
        game_id: gameId,
        tournament_id: tournamentId
      })
      .select();

    if (scoreError) {
      console.error('❌ Error submitting score:', scoreError);
      return;
    }

    console.log('✅ Score submitted successfully:', scoreData);

    // Wait a moment for triggers to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if achievements were awarded
    console.log('\n🏅 Checking for awarded achievements...');
    const { data: playerAchievements, error: achError } = await supabase
      .from('player_achievements')
      .select(`
        *,
        achievements(name, description, points)
      `)
      .eq('player_name', testPlayerName)
      .eq('tournament_id', tournamentId);

    if (achError) {
      console.error('❌ Error checking achievements:', achError);
    } else {
      console.log(`✅ Found ${playerAchievements?.length || 0} achievements for ${testPlayerName}:`);
      playerAchievements?.forEach(pa => {
        console.log(`  🏆 ${pa.achievements.name} - ${pa.achievements.description} (${pa.achievements.points} points)`);
      });
    }

    // Test the query that the frontend uses
    console.log('\n📊 Testing frontend achievement hunter query...');
    const { data: achievementHunters, error: hunterError } = await supabase
      .from('player_achievements')
      .select(`
        player_name,
        achievements!inner(points)
      `)
      .eq('tournament_id', tournamentId);

    if (hunterError) {
      console.error('❌ Error with hunter query:', hunterError);
    } else {
      console.log('✅ Achievement hunters query result:', achievementHunters);

      // Process the data like the frontend does
      const hunterMap = new Map();
      achievementHunters?.forEach(item => {
        const playerName = item.player_name;
        if (!hunterMap.has(playerName)) {
          hunterMap.set(playerName, {
            player_name: playerName,
            achievement_count: 0,
            total_points: 0
          });
        }
        const hunter = hunterMap.get(playerName);
        hunter.achievement_count++;
        hunter.total_points += item.achievements.points;
      });

      const hunters = Array.from(hunterMap.values())
        .sort((a, b) => b.total_points - a.total_points);

      console.log('📈 Processed achievement hunters:', hunters);
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    if (scoreData?.[0]?.id) {
      await supabase
        .from('scores')
        .delete()
        .eq('id', scoreData[0].id);
      console.log('✅ Test score deleted');
    }

    if (playerAchievements && playerAchievements.length > 0) {
      await supabase
        .from('player_achievements')
        .delete()
        .eq('player_name', testPlayerName);
      console.log('✅ Test achievements deleted');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testScoreAchievement();