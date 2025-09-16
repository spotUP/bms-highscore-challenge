import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAllSystemTests() {
  console.log('🧪 Running comprehensive system tests...\n');

  let allTestsPassed = true;
  const results: any = {};

  try {
    // Test 1: Database Schema Access
    console.log('1️⃣ Testing database schema access...');
    const schemaTests = await Promise.allSettled([
      supabase.from('scores').select('id').limit(1),
      supabase.from('achievements').select('id').limit(1),
      supabase.from('player_achievements').select('id').limit(1),
      supabase.from('games').select('id').limit(1)
    ]);

    const schemaSuccess = schemaTests.every(test => test.status === 'fulfilled');
    results.schema = schemaSuccess;
    console.log(schemaSuccess ? '✅ Schema access: OK' : '❌ Schema access: FAILED');

    // Test 2: Player Name Length Constraints
    console.log('\n2️⃣ Testing player name length constraints...');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: games } = await supabase.from('games').select('*').limit(1);

    if (!games || games.length === 0) {
      throw new Error('No games available for testing');
    }

    const game = games[0];
    const name16 = '1234567890123456'; // 16 chars
    const name17 = '12345678901234567'; // 17 chars

    const { error: error16 } = await supabase
      .from('scores')
      .insert({
        player_name: name16,
        score: 100,
        game_id: game.id,
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      });

    const { error: error17 } = await supabase
      .from('scores')
      .insert({
        player_name: name17,
        score: 100,
        game_id: game.id,
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      });

    const nameConstraintsWork = !error16 && !!error17;
    results.nameConstraints = nameConstraintsWork;
    console.log(nameConstraintsWork ? '✅ Name constraints: OK' : '❌ Name constraints: FAILED');

    // Clean up
    if (!error16) await supabase.from('scores').delete().eq('player_name', name16);
    if (!error17) await supabase.from('scores').delete().eq('player_name', name17);

    // Test 3: Score Submission with user_id
    console.log('\n3️⃣ Testing score submission with user_id...');
    const testPlayerName = 'SYST' + Date.now().toString().slice(-4);

    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .insert({
        player_name: testPlayerName,
        score: 50000,
        game_id: game.id,
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      })
      .select();

    const scoreSubmissionWorks = !scoreError && scoreData && scoreData.length > 0;
    const userIdIncluded = scoreData && scoreData[0]?.user_id !== undefined;
    results.scoreSubmission = scoreSubmissionWorks && userIdIncluded;
    console.log(scoreSubmissionWorks ? '✅ Score submission: OK' : '❌ Score submission: FAILED');
    console.log(userIdIncluded ? '✅ user_id field: OK' : '❌ user_id field: MISSING');

    // Test 4: Achievement System
    console.log('\n4️⃣ Testing achievement system...');
    // Wait for triggers to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    const { data: achievements } = await supabase
      .from('player_achievements')
      .select('*, achievements (name)')
      .eq('player_name', testPlayerName);

    const achievementsWork = achievements && achievements.length > 0;
    results.achievements = achievementsWork;
    console.log(achievementsWork ? `✅ Achievements: ${achievements?.length || 0} awarded` : '❌ Achievements: FAILED');

    // Clean up
    await supabase.from('scores').delete().eq('player_name', testPlayerName);
    await supabase.from('player_achievements').delete().eq('player_name', testPlayerName);

    // Overall Results
    allTestsPassed = Object.values(results).every(result => result === true);

    console.log('\n📊 FINAL RESULTS:');
    console.log('================');
    console.log(`Database Schema:     ${results.schema ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Name Constraints:    ${results.nameConstraints ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Score Submission:    ${results.scoreSubmission ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Achievement System:  ${results.achievements ? '✅ PASS' : '❌ FAIL'}`);
    console.log('================');
    console.log(`Overall Status:      ${allTestsPassed ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);

  } catch (error: any) {
    console.error('\n❌ System test failed:', error.message);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

runAllSystemTests();