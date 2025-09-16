import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function debugAchievementTournamentIssue() {
  console.log('🔍 Debugging achievement tournament issue...\n');

  try {
    // Check available tournaments
    console.log('1. Checking available tournaments...');
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, is_active')
      .order('created_at', { ascending: false })
      .limit(5);

    if (tournamentsError) {
      console.log('❌ Error fetching tournaments:', tournamentsError);
    } else {
      console.log('✅ Available tournaments:');
      tournaments?.forEach(t => {
        console.log(`   - ${t.name} (ID: ${t.id}, Active: ${t.is_active})`);
      });
    }

    // Check achievements and their tournament association
    console.log('\n2. Checking achievements and their tournament association...');
    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('id, name, tournament_id, is_active, type, criteria')
      .eq('is_active', true);

    if (achievementsError) {
      console.log('❌ Error fetching achievements:', achievementsError);
    } else {
      console.log('✅ Active achievements:');
      achievements?.forEach(a => {
        console.log(`   - ${a.name} (Tournament: ${a.tournament_id || 'NULL'}, Type: ${a.type})`);
        console.log(`     Criteria: ${JSON.stringify(a.criteria)}`);
      });
    }

    // Check if there are any global achievements (tournament_id = null)
    console.log('\n3. Checking for global achievements...');
    const { data: globalAchievements, error: globalError } = await supabase
      .from('achievements')
      .select('id, name, type, criteria')
      .eq('is_active', true)
      .is('tournament_id', null);

    if (globalError) {
      console.log('❌ Error checking global achievements:', globalError);
    } else if (globalAchievements && globalAchievements.length > 0) {
      console.log('✅ Global achievements found:');
      globalAchievements?.forEach(a => {
        console.log(`   - ${a.name} (Type: ${a.type})`);
      });
    } else {
      console.log('❌ No global achievements found - this explains why achievements aren\'t triggering!');
    }

    // Check the specific test scenario - try to insert a score in the default tournament
    if (tournaments && tournaments.length > 0) {
      const defaultTournament = tournaments.find(t => t.is_active) || tournaments[0];
      console.log(`\n4. Testing with tournament: ${defaultTournament.name}`);

      const testPlayer = 'DEBUG_TOURNAMENT_' + Math.random().toString(36).substring(7);

      // Get a real game ID
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('id, name')
        .limit(1);

      if (gamesError || !games || games.length === 0) {
        console.log('❌ No games available for testing');
        return;
      }

      const game = games[0];
      console.log(`Using game: ${game.name} (${game.id})`);

      // Insert score with tournament_id
      const { data: scoreData, error: scoreError } = await supabase
        .from('scores')
        .insert({
          player_name: testPlayer,
          score: 25000,
          game_id: game.id,
          tournament_id: defaultTournament.id
        })
        .select()
        .single();

      if (scoreError) {
        console.log('❌ Error inserting score:', scoreError);
      } else {
        console.log('✅ Score inserted successfully');

        // Wait for trigger
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check for achievements
        const { data: awardedAchievements, error: awardedError } = await supabase
          .from('player_achievements')
          .select(`
            *,
            achievements (
              name,
              description
            )
          `)
          .eq('player_name', testPlayer);

        if (awardedError) {
          console.log('❌ Error checking awarded achievements:', awardedError);
        } else if (awardedAchievements && awardedAchievements.length > 0) {
          console.log('✅ Achievements awarded:');
          awardedAchievements.forEach(ach => {
            console.log(`   🏆 ${ach.achievements?.name}: ${ach.achievements?.description}`);
          });
        } else {
          console.log('❌ Still no achievements awarded - may be a function issue');
        }

        // Clean up
        await supabase.from('player_achievements').delete().eq('player_name', testPlayer);
        await supabase.from('scores').delete().eq('player_name', testPlayer);
        console.log('✅ Test data cleaned up');
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugAchievementTournamentIssue().catch(console.error);