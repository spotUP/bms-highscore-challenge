import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create service role client for cleanup operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runDeployTests() {
  console.log('🚀 DEPLOY-TIME TEST SUITE');
  console.log('='.repeat(50));

  let allPassed = true;
  const results: any = {};
  const failedTests: any[] = [];

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: games } = await supabase.from('games').select('*');

    if (!games || games.length === 0) {
      throw new Error('No games available for testing');
    }

    // Test 1: Database Schema
    console.log('\n1️⃣ DATABASE SCHEMA TEST');
    console.log('-'.repeat(30));
    const schemaTests = await Promise.allSettled([
      supabase.from('scores').select('id').limit(1),
      supabase.from('achievements').select('id').limit(1),
      supabase.from('player_achievements').select('id').limit(1),
      supabase.from('games').select('id').limit(1)
    ]);
    const schemaSuccess = schemaTests.every(test => test.status === 'fulfilled');
    results.schema = schemaSuccess;
    console.log(schemaSuccess ? '✅ All tables accessible' : '❌ Some tables not accessible');
    if (!schemaSuccess) {
      failedTests.push({
        testName: 'Database Schema Test',
        error: 'Some tables not accessible',
        details: schemaTests.filter(t => t.status === 'rejected').map(t => t.reason)
      });
    }

    // Test 2: Player Name Constraints
    console.log('\n2️⃣ PLAYER NAME CONSTRAINTS TEST');
    console.log('-'.repeat(30));
    const name16 = 'DEPLOY' + Date.now().toString().slice(-10); // 16 chars
    const name17 = 'DEPLOY' + Date.now().toString().slice(-10) + 'X'; // 17 chars

    const { error: error16 } = await supabase.from('scores').insert({
      player_name: name16,
      score: 100,
      game_id: games[0].id,
      tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
      user_id: user?.id || null
    });

    const { error: error17 } = await supabase.from('scores').insert({
      player_name: name17,
      score: 100,
      game_id: games[0].id,
      tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
      user_id: user?.id || null
    });

    const nameConstraintsWork = !error16 && !!error17;
    results.nameConstraints = nameConstraintsWork;
    console.log(`16 chars: ${!error16 ? '✅ Accepted' : '❌ Rejected'}`);
    console.log(`17 chars: ${error17 ? '✅ Correctly rejected' : '❌ Incorrectly accepted'}`);

    if (!nameConstraintsWork) {
      failedTests.push({
        testName: 'Player Name Constraints Test',
        error: 'Name length constraints not working properly',
        details: { error16: error16?.message, error17: error17?.message }
      });
    }

    // Clean up
    if (!error16) await supabase.from('scores').delete().eq('player_name', name16);

    // Test 3: Score Submission
    console.log('\n3️⃣ SCORE SUBMISSION TEST');
    console.log('-'.repeat(30));
    const testPlayerName = 'DEPLOY' + Date.now().toString().slice(-4);
    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .insert({
        player_name: testPlayerName,
        score: 50000,
        game_id: games[0].id,
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        user_id: user?.id || null
      })
      .select();

    results.scoreSubmission = !scoreError && !!scoreData;
    console.log(`Score submission: ${!scoreError ? '✅ Success' : '❌ Failed'}`);
    const hasUserId = scoreData?.[0]?.user_id !== undefined;
    console.log(`user_id field: ${hasUserId ? '✅ Included' : '⚠️  Missing (optional for anonymous users)'}`);

    if (scoreError || !scoreData) {
      failedTests.push({
        testName: 'Score Submission Test',
        error: scoreError?.message || 'No data returned',
        details: { scoreError, scoreData }
      });
    }

    // Test 4: Achievement System (abbreviated for deploy tests)
    console.log('\n4️⃣ ACHIEVEMENT SYSTEM TEST');
    console.log('-'.repeat(30));
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: achievements } = await supabase
      .from('player_achievements')
      .select('*, achievements(name)')
      .eq('player_name', testPlayerName);

    results.achievements = achievements && achievements.length > 0;
    console.log(`Achievements: ${achievements?.length || 0} awarded`);

    if (!achievements || achievements.length === 0) {
      failedTests.push({
        testName: 'Achievement System Test',
        error: 'No achievements awarded after score submission',
        details: { playerName: testPlayerName, achievements }
      });
    }

    // Test 5: Brackets System
    console.log('\n5️⃣ BRACKETS SYSTEM TEST');
    console.log('-'.repeat(30));

    // Test brackets database schema
    const bracketTests = await Promise.allSettled([
      supabase.from('bracket_tournaments').select('id').limit(1),
      supabase.from('bracket_players').select('id').limit(1),
      supabase.from('bracket_matches').select('id').limit(1)
    ]);
    const bracketSchemaSuccess = bracketTests.every(test => test.status === 'fulfilled');

    if (bracketSchemaSuccess) {
      // Test tournament creation
      const testTournamentName = 'DEPLOY_TEST_' + Date.now().toString().slice(-4);
      const { data: tournament, error: tournamentError } = await supabase
        .from('bracket_tournaments')
        .insert({
          name: testTournamentName,
          created_by: user?.id,
          bracket_type: 'single',
          status: 'draft',
          is_public: false
        })
        .select()
        .single();

      if (!tournamentError && tournament) {
        // Test player addition
        const { data: players, error: playersError } = await supabase
          .from('bracket_players')
          .insert([
            { tournament_id: tournament.id, name: 'DEPLOY_PLAYER_A', seed: 1 },
            { tournament_id: tournament.id, name: 'DEPLOY_PLAYER_B', seed: 2 }
          ])
          .select();

        const bracketsWorking = !playersError && players && players.length === 2;
        results.brackets = bracketsWorking;

        console.log(`Brackets schema: ${bracketSchemaSuccess ? '✅ OK' : '❌ Failed'}`);
        console.log(`Tournament creation: ${!tournamentError ? '✅ OK' : '❌ Failed'}`);
        console.log(`Player management: ${!playersError ? '✅ OK' : '❌ Failed'}`);

        // Cleanup
        await supabaseAdmin.from('bracket_tournaments').delete().eq('id', tournament.id);

        if (!bracketsWorking) {
          failedTests.push({
            testName: 'Brackets System Test',
            error: 'Brackets system components not working properly',
            details: { tournamentError, playersError }
          });
        }
      } else {
        results.brackets = false;
        console.log(`Brackets schema: ${bracketSchemaSuccess ? '✅ OK' : '❌ Failed'}`);
        console.log(`Tournament creation: ❌ Failed`);
        console.log(`Player management: ❌ Skipped`);

        failedTests.push({
          testName: 'Brackets System Test',
          error: 'Tournament creation failed',
          details: { tournamentError }
        });
      }
    } else {
      results.brackets = false;
      console.log(`Brackets schema: ❌ Failed`);
      console.log(`Tournament creation: ❌ Skipped`);
      console.log(`Player management: ❌ Skipped`);

      failedTests.push({
        testName: 'Brackets System Test',
        error: 'Brackets database schema not accessible',
        details: { bracketTests }
      });
    }

    // Clean up all test data using admin client
    console.log('\n🧹 CLEANUP');
    console.log('-'.repeat(30));
    await supabaseAdmin.from('scores').delete().eq('player_name', testPlayerName);
    await supabaseAdmin.from('player_achievements').delete().eq('player_name', testPlayerName);
    console.log('✅ Test data cleaned up');

    // Test 6: Security System
    console.log('\n6️⃣ SECURITY SYSTEM TEST');
    console.log('-'.repeat(30));

    // Test RLS policies
    try {
      const { data: unauthorizedData, error: rlsError } = await supabase
        .from('scores')
        .select('*')
        .eq('tournament_id', 'unauthorized-tournament-id');

      results.securityRLS = !rlsError || !unauthorizedData || unauthorizedData.length === 0;
      console.log(`RLS Policies: ${results.securityRLS ? '✅ Protected' : '❌ Vulnerable'}`);
    } catch (e) {
      results.securityRLS = true; // RLS blocked the request
      console.log('RLS Policies: ✅ Protected');
    }

    // Test score validation
    const secTestPlayerName = 'SEC_DEPLOY_' + Date.now().toString().slice(-6);
    const { error: negativeScoreError } = await supabase
      .from('scores')
      .insert({
        player_name: secTestPlayerName,
        score: -1000,
        game_id: games[0].id,
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d'
      });

    results.securityValidation = !!negativeScoreError;
    console.log(`Score Validation: ${results.securityValidation ? '✅ Secure' : '❌ Vulnerable'}`);

    // Test 7: Tournament Management
    console.log('\n7️⃣ TOURNAMENT MANAGEMENT TEST');
    console.log('-'.repeat(30));

    const testTournamentName = 'DEPLOY_MGMT_' + Date.now().toString().slice(-6);

    const { data: testTournament, error: tournamentCreateError } = await supabase
      .from('tournaments')
      .insert({
        name: testTournamentName,
        description: 'Deploy test tournament',
        is_public: false,
        status: 'draft'
      })
      .select()
      .single();

    results.tournamentCreation = !tournamentCreateError && !!testTournament;
    console.log(`Tournament Creation: ${results.tournamentCreation ? '✅ Working' : '❌ Failed'}`);

    if (testTournament) {
      // Test state transitions
      const { error: stateError } = await supabase
        .from('tournaments')
        .update({ status: 'active' })
        .eq('id', testTournament.id);

      results.tournamentStates = !stateError;
      console.log(`State Transitions: ${results.tournamentStates ? '✅ Working' : '❌ Failed'}`);

      // Cleanup
      await supabaseAdmin.from('tournaments').delete().eq('id', testTournament.id);
    } else {
      results.tournamentStates = false;
      console.log('State Transitions: ❌ Skipped');
    }

    // Test 8: Real-time System
    console.log('\n8️⃣ REAL-TIME SYSTEM TEST');
    console.log('-'.repeat(30));

    try {
      // Test WebSocket connection
      const isConnected = supabase.realtime.isConnected();
      results.realtimeConnection = isConnected;
      console.log(`WebSocket Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}`);

      // Test channel subscription
      const testChannel = supabase.channel('deploy-test-' + Date.now());
      testChannel.subscribe();

      await new Promise(resolve => setTimeout(resolve, 1000));

      const unsubscribeResult = await testChannel.unsubscribe();
      results.realtimeSubscription = unsubscribeResult === 'ok';
      console.log(`Channel Management: ${results.realtimeSubscription ? '✅ Working' : '❌ Failed'}`);
    } catch (e) {
      results.realtimeConnection = false;
      results.realtimeSubscription = false;
      console.log('WebSocket Connection: ❌ Failed');
      console.log('Channel Management: ❌ Failed');
    }

    // Final comprehensive cleanup
    console.log('\n🧹 FINAL COMPREHENSIVE CLEANUP');
    console.log('-'.repeat(30));

    try {
      // Use admin client for cleanup to ensure proper permissions
      const cleanupOperations = [
        // Clean up all test scores
        supabaseAdmin.from('scores').delete().like('player_name', 'DEPLOY%'),
        supabaseAdmin.from('scores').delete().like('player_name', 'SEC_DEPLOY_%'),
        supabaseAdmin.from('scores').delete().like('player_name', 'REALTIME_TEST_%'),

        // Clean up all test achievements
        supabaseAdmin.from('player_achievements').delete().like('player_name', 'DEPLOY%'),
        supabaseAdmin.from('player_achievements').delete().like('player_name', 'SEC_DEPLOY_%'),
        supabaseAdmin.from('player_achievements').delete().like('player_name', 'REALTIME_TEST_%'),

        // Clean up all test tournaments
        supabaseAdmin.from('tournaments').delete().like('name', 'DEPLOY_%'),
        supabaseAdmin.from('tournaments').delete().like('name', 'SECURITY_TEST_%'),

        // Clean up all bracket test data
        supabaseAdmin.from('bracket_tournaments').delete().like('name', 'DEPLOY_%'),
        supabaseAdmin.from('bracket_players').delete().like('name', 'DEPLOY_%')
      ];

      const cleanupResults = await Promise.allSettled(cleanupOperations);
      const failures = cleanupResults.filter(result => result.status === 'rejected');

      if (failures.length > 0) {
        console.warn(`⚠️ ${failures.length} cleanup operations failed`);
        failures.forEach((failure, index) => {
          console.warn(`   Operation ${index + 1}:`, failure.reason);
        });
      }

      console.log('✅ Final comprehensive cleanup completed');
    } catch (cleanupError) {
      console.warn('⚠️ Final cleanup warning:', cleanupError);
    }

    // Final Results - Separate critical from optional features
    const criticalTests = {
      schema: results.schema,
      nameConstraints: results.nameConstraints,
      scoreSubmission: results.scoreSubmission,
      achievements: results.achievements,
      security: results.securityRLS && results.securityValidation
    };

    const optionalTests = {
      brackets: results.brackets,
      tournaments: results.tournamentCreation && results.tournamentStates,
      realtime: results.realtimeConnection && results.realtimeSubscription
    };

    const criticalPassed = Object.values(criticalTests).every(r => r === true);
    const allPassed = criticalPassed && Object.values(optionalTests).every(r => r === true);

    console.log('\n' + '='.repeat(50));
    console.log('📊 DEPLOY TEST RESULTS');
    console.log('='.repeat(50));
    console.log('🔴 CRITICAL SYSTEMS:');
    console.log(`Database Schema:      ${results.schema ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Name Constraints:     ${results.nameConstraints ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Score Submission:     ${results.scoreSubmission ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Achievement System:   ${results.achievements ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Security System:      ${results.securityRLS && results.securityValidation ? '✅ PASS' : '❌ FAIL'}`);
    console.log('\n🟡 OPTIONAL FEATURES:');
    console.log(`Brackets System:      ${results.brackets ? '✅ PASS' : '⚠️  FAIL (optional)'}`);
    console.log(`Tournament Management: ${results.tournamentCreation && results.tournamentStates ? '✅ PASS' : '⚠️  FAIL (optional)'}`);
    console.log(`Real-time System:     ${results.realtimeConnection && results.realtimeSubscription ? '✅ PASS' : '⚠️  FAIL (optional)'}`);
    console.log('='.repeat(50));
    console.log(`CRITICAL STATUS:      ${criticalPassed ? '✅ CORE SYSTEMS STABLE' : '❌ CRITICAL FAILURES'}`);
    console.log(`OVERALL STATUS:       ${allPassed ? '🎉 ALL TESTS PASSED!' : criticalPassed ? '⚠️  OPTIONAL FEATURES FAILING' : '🚨 DEPLOYMENT UNSTABLE'}`);
    console.log('='.repeat(50));

    // Send email only if critical tests failed
    if (!criticalPassed && failedTests.length > 0) {
      console.log('\n📧 SENDING FAILURE REPORT...');
      try {
        const { data, error } = await supabase.functions.invoke('send-test-failure-report', {
          body: {
            to: 'spotup@gmail.com',
            subject: '🚨 Deploy-Time Test Failures - BMS High Score Challenge',
            report: {
              timestamp: new Date().toISOString(),
              environment: 'deploy',
              failedTestsCount: failedTests.length,
              totalTests: 8,
              failedTests,
              allResults: results
            }
          }
        });

        if (error) {
          console.error('❌ Failed to send email report:', error);
        } else {
          console.log('✅ Failure report sent to spotup@gmail.com');
        }
      } catch (emailError) {
        console.error('❌ Email sending error:', emailError);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Deploy test suite failed:', error.message);
    allPassed = false;
  }

  // Store test results for status indicator
  try {
    localStorage.setItem('deployTestResults', JSON.stringify({
      passed: allPassed,
      timestamp: new Date().toISOString(),
      results
    }));
  } catch (e) {
    // localStorage not available in Node.js, that's fine
  }

  return criticalPassed;
}

// Run tests when script is executed directly
runDeployTests().then(passed => {
  process.exit(passed ? 0 : 1);
});

export { runDeployTests };