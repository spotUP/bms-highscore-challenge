import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testAchievementWithRealGame() {
  console.log('🎯 Testing achievement triggering with real game data...\n');

  try {
    // First, get a real game ID
    console.log('1. Fetching available games...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, name')
      .limit(1);

    if (gamesError || !games || games.length === 0) {
      console.log('❌ Error fetching games or no games available:', gamesError);
      return;
    }

    const game = games[0];
    console.log(`✅ Using game: ${game.name} (ID: ${game.id})`);

    const testPlayer = 'TEST_' + Math.random().toString(36).substring(7);

    // Get the active tournament
    console.log('\\n1.5. Getting active tournament...');
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (tournamentsError || !tournaments || tournaments.length === 0) {
      console.log('❌ Error fetching tournaments or no active tournament:', tournamentsError);
      return;
    }

    const tournament = tournaments[0];
    console.log(`✅ Using tournament: ${tournament.name} (ID: ${tournament.id})`);

    console.log('\n2. Testing score insertion that should trigger achievements...');

    // Try to insert a score the way the real app does
    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .insert({
        player_name: testPlayer,
        score: 25000,
        game_id: game.id,
        tournament_id: tournament.id
      })
      .select()
      .single();

    if (scoreError) {
      console.log('❌ Error inserting score:', scoreError);
      return;
    }

    console.log('✅ Score inserted successfully:', scoreData);

    // Wait a moment for triggers to execute
    console.log('\n3. Waiting 3 seconds for triggers to execute...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if achievements were awarded
    console.log('\n4. Checking for awarded achievements...');
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

    // Let's also check all available achievements to make sure they exist
    console.log('\n5. Checking available achievements...');
    const { data: allAchievements, error: allAchError } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true);

    if (allAchError) {
      console.log('❌ Error fetching achievements:', allAchError);
    } else {
      console.log('✅ Available achievements:');
      allAchievements?.forEach(ach => {
        console.log(`   - ${ach.name}: ${ach.description} (Criteria: ${ach.criteria})`);
      });
    }

    // Clean up
    console.log('\n6. Cleaning up test data...');
    await supabase.from('player_achievements').delete().eq('player_name', testPlayer);
    await supabase.from('scores').delete().eq('player_name', testPlayer);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAchievementWithRealGame().catch(console.error);