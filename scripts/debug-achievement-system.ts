#!/usr/bin/env npx tsx

/**
 * Achievement System Debug Script
 *
 * This script investigates why achievement hunters are not getting achievements.
 * It checks the database schema, triggers, functions, and tests the achievement
 * awarding logic to identify root causes.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/integrations/supabase/types';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

interface DebugResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO';
  message: string;
  data?: any;
}

const results: DebugResult[] = [];

function log(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO', message: string, data?: any) {
  const result = { category, test, status, message, data };
  results.push(result);

  const emoji = {
    PASS: '✅',
    FAIL: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️'
  }[status];

  console.log(`${emoji} [${category}] ${test}: ${message}`);
  if (data && Object.keys(data).length > 0) {
    console.log('   Data:', JSON.stringify(data, null, 2).replace(/\n/g, '\n   '));
  }
  console.log();
}

async function checkDatabaseSchema() {
  console.log('🔍 Checking Database Schema...\n');

  // Check if achievements table exists and has required columns
  try {
    const { data: achievements, error } = await supabase
      .from('achievements')
      .select('*')
      .limit(1);

    if (error) {
      log('SCHEMA', 'Achievements Table', 'FAIL', `Cannot access achievements table: ${error.message}`);
      return;
    }

    log('SCHEMA', 'Achievements Table', 'PASS', 'Achievements table is accessible');

    // Check if player_achievements table exists
    const { data: playerAchievements, error: paError } = await supabase
      .from('player_achievements')
      .select('*')
      .limit(1);

    if (paError) {
      log('SCHEMA', 'Player Achievements Table', 'FAIL', `Cannot access player_achievements table: ${paError.message}`);
      return;
    }

    log('SCHEMA', 'Player Achievements Table', 'PASS', 'Player achievements table is accessible');

  } catch (err) {
    log('SCHEMA', 'Database Connection', 'FAIL', `Failed to connect: ${err}`);
  }
}

async function checkExistingAchievements() {
  console.log('🏆 Checking Existing Achievements...\n');

  try {
    // Get all tournaments
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, is_active')
      .order('created_at', { ascending: false });

    if (tournamentsError) {
      log('DATA', 'Tournaments', 'FAIL', `Cannot fetch tournaments: ${tournamentsError.message}`);
      return;
    }

    log('DATA', 'Tournaments', 'INFO', `Found ${tournaments?.length || 0} tournaments`,
        { tournaments: tournaments?.map(t => ({ id: t.id, name: t.name, is_active: t.is_active })) });

    // Check achievements for each tournament
    for (const tournament of tournaments || []) {
      const { data: achievements, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .eq('tournament_id', tournament.id);

      if (achievementsError) {
        log('DATA', 'Tournament Achievements', 'FAIL',
            `Cannot fetch achievements for tournament ${tournament.name}: ${achievementsError.message}`);
        continue;
      }

      const activeAchievements = achievements?.filter(a => a.is_active) || [];

      if (achievements && achievements.length > 0) {
        log('DATA', 'Tournament Achievements', 'PASS',
            `Tournament "${tournament.name}" has ${achievements.length} achievements (${activeAchievements.length} active)`,
            {
              tournament_id: tournament.id,
              total_achievements: achievements.length,
              active_achievements: activeAchievements.length,
              achievements: achievements.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                is_active: a.is_active,
                criteria: a.criteria
              }))
            });
      } else {
        log('DATA', 'Tournament Achievements', 'WARNING',
            `Tournament "${tournament.name}" has no achievements`);
      }
    }

  } catch (err) {
    log('DATA', 'Achievement Check', 'FAIL', `Error checking achievements: ${err}`);
  }
}

async function checkDatabaseTriggers() {
  console.log('⚙️ Checking Database Triggers and Functions...\n');

  try {
    // Check if the achievement trigger function exists
    const { data: functions, error: functionsError } = await supabase
      .rpc('execute_sql', {
        sql: `
          SELECT
            routine_name,
            routine_type,
            created,
            last_altered
          FROM information_schema.routines
          WHERE routine_schema = 'public'
          AND routine_name LIKE '%achievement%'
          ORDER BY routine_name;
        `
      });

    if (functionsError) {
      log('TRIGGERS', 'Check Functions', 'WARNING',
          `Cannot check achievement functions: ${functionsError.message}`);
    } else {
      log('TRIGGERS', 'Achievement Functions', 'INFO',
          `Found ${functions?.length || 0} achievement-related functions`,
          { functions });
    }

    // Check if the trigger exists
    const { data: triggers, error: triggersError } = await supabase
      .rpc('execute_sql', {
        sql: `
          SELECT
            trigger_name,
            event_manipulation,
            action_statement,
            action_timing
          FROM information_schema.triggers
          WHERE event_object_table = 'scores'
          AND trigger_name LIKE '%achievement%';
        `
      });

    if (triggersError) {
      log('TRIGGERS', 'Check Triggers', 'WARNING',
          `Cannot check achievement triggers: ${triggersError.message}`);
    } else {
      if (triggers && triggers.length > 0) {
        log('TRIGGERS', 'Achievement Triggers', 'PASS',
            `Found ${triggers.length} achievement trigger(s) on scores table`,
            { triggers });
      } else {
        log('TRIGGERS', 'Achievement Triggers', 'FAIL',
            'No achievement triggers found on scores table');
      }
    }

  } catch (err) {
    log('TRIGGERS', 'Database Inspection', 'FAIL', `Error checking triggers: ${err}`);
  }
}

async function checkPlayerAchievements() {
  console.log('👥 Checking Player Achievement Records...\n');

  try {
    // Get recent player achievements
    const { data: recentAchievements, error: recentError } = await supabase
      .from('player_achievements')
      .select(`
        *,
        achievement:achievements(name, description, type, is_active),
        tournament:tournaments(name)
      `)
      .order('earned_at', { ascending: false })
      .limit(10);

    if (recentError) {
      log('PLAYER_DATA', 'Recent Achievements', 'FAIL',
          `Cannot fetch recent achievements: ${recentError.message}`);
    } else {
      log('PLAYER_DATA', 'Recent Achievements', 'INFO',
          `Found ${recentAchievements?.length || 0} recent player achievements`,
          { recent_achievements: recentAchievements });
    }

    // Get total player achievement count
    const { count: totalAchievements, error: countError } = await supabase
      .from('player_achievements')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      log('PLAYER_DATA', 'Total Achievement Count', 'FAIL',
          `Cannot count achievements: ${countError.message}`);
    } else {
      log('PLAYER_DATA', 'Total Achievement Count', 'INFO',
          `Total player achievements in database: ${totalAchievements || 0}`);
    }

  } catch (err) {
    log('PLAYER_DATA', 'Player Achievement Check', 'FAIL', `Error: ${err}`);
  }
}

async function testAchievementSystem() {
  console.log('🧪 Testing Achievement System...\n');

  try {
    // Get an active tournament to test with
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (tournamentsError || !tournaments || tournaments.length === 0) {
      log('TEST', 'Tournament Selection', 'WARNING',
          'No active tournaments found for testing');
      return;
    }

    const testTournament = tournaments[0];
    log('TEST', 'Tournament Selection', 'INFO',
        `Using tournament: ${testTournament.name}`, { tournament_id: testTournament.id });

    // Get a game to test with
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (gamesError || !games || games.length === 0) {
      log('TEST', 'Game Selection', 'WARNING',
          'No active games found for testing');
      return;
    }

    const testGame = games[0];
    log('TEST', 'Game Selection', 'INFO',
        `Using game: ${testGame.name}`, { game_id: testGame.id });

    // Check if there are achievements for this tournament
    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*')
      .eq('tournament_id', testTournament.id)
      .eq('is_active', true);

    if (achievementsError) {
      log('TEST', 'Achievement Check', 'FAIL',
          `Cannot check achievements: ${achievementsError.message}`);
      return;
    }

    if (!achievements || achievements.length === 0) {
      log('TEST', 'Achievement Check', 'FAIL',
          'No active achievements found for test tournament');
      return;
    }

    log('TEST', 'Achievement Check', 'PASS',
        `Found ${achievements.length} active achievements for testing`,
        { achievements: achievements.map(a => ({ id: a.id, name: a.name, type: a.type })) });

    // Test the achievement function directly (if available)
    try {
      const testPlayerName = `test_player_${Date.now()}`;
      const testScore = 1500; // Should trigger "Getting Started" achievement

      log('TEST', 'Direct Function Test', 'INFO',
          `Testing achievement function with score: ${testScore}`);

      const { data: functionResult, error: functionError } = await supabase
        .rpc('check_and_award_achievements_v2', {
          p_score_id: crypto.randomUUID(),
          p_player_name: testPlayerName,
          p_game_id: testGame.id,
          p_score: testScore,
          p_tournament_id: testTournament.id,
          p_user_id: null
        });

      if (functionError) {
        log('TEST', 'Function Call', 'FAIL',
            `Achievement function failed: ${functionError.message}`);
      } else {
        log('TEST', 'Function Call', 'PASS',
            `Achievement function executed successfully`,
            { result: functionResult });
      }

    } catch (err) {
      log('TEST', 'Function Test', 'WARNING',
          `Cannot test achievement function directly: ${err}`);
    }

  } catch (err) {
    log('TEST', 'Achievement System Test', 'FAIL', `Error: ${err}`);
  }
}

async function checkSchemaConsistency() {
  console.log('📋 Checking Schema Consistency...\n');

  try {
    // Check if achievements table has all required columns from the migration
    const { data: achievementColumns, error: columnsError } = await supabase
      .rpc('execute_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'achievements'
          ORDER BY ordinal_position;
        `
      });

    if (columnsError) {
      log('SCHEMA_CHECK', 'Achievement Columns', 'WARNING',
          `Cannot check achievement table columns: ${columnsError.message}`);
    } else {
      const requiredColumns = ['id', 'name', 'description', 'type', 'badge_icon', 'badge_color', 'criteria', 'points', 'is_active', 'tournament_id'];
      const actualColumns = achievementColumns?.map((col: any) => col.column_name) || [];
      const missingColumns = requiredColumns.filter(col => !actualColumns.includes(col));

      if (missingColumns.length === 0) {
        log('SCHEMA_CHECK', 'Achievement Columns', 'PASS',
            'All required columns present in achievements table',
            { columns: actualColumns });
      } else {
        log('SCHEMA_CHECK', 'Achievement Columns', 'FAIL',
            `Missing required columns in achievements table: ${missingColumns.join(', ')}`,
            { missing: missingColumns, actual: actualColumns });
      }
    }

    // Check player_achievements table columns
    const { data: paColumns, error: paColumnsError } = await supabase
      .rpc('execute_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'player_achievements'
          ORDER BY ordinal_position;
        `
      });

    if (paColumnsError) {
      log('SCHEMA_CHECK', 'Player Achievement Columns', 'WARNING',
          `Cannot check player_achievements table columns: ${paColumnsError.message}`);
    } else {
      const requiredPAColumns = ['id', 'player_name', 'achievement_id', 'tournament_id', 'score_id', 'user_id', 'earned_at'];
      const actualPAColumns = paColumns?.map((col: any) => col.column_name) || [];
      const missingPAColumns = requiredPAColumns.filter(col => !actualPAColumns.includes(col));

      if (missingPAColumns.length === 0) {
        log('SCHEMA_CHECK', 'Player Achievement Columns', 'PASS',
            'All required columns present in player_achievements table',
            { columns: actualPAColumns });
      } else {
        log('SCHEMA_CHECK', 'Player Achievement Columns', 'FAIL',
            `Missing required columns in player_achievements table: ${missingPAColumns.join(', ')}`,
            { missing: missingPAColumns, actual: actualPAColumns });
      }
    }

  } catch (err) {
    log('SCHEMA_CHECK', 'Schema Consistency', 'FAIL', `Error: ${err}`);
  }
}

async function checkRealtimeSubscriptions() {
  console.log('📡 Checking Real-time Configuration...\n');

  try {
    // Check if realtime is enabled for relevant tables
    const { data: realtimeConfig, error: realtimeError } = await supabase
      .rpc('execute_sql', {
        sql: `
          SELECT
            schemaname as schema_name,
            tablename as table_name,
            hasindexes as has_indexes,
            hasrules as has_rules,
            hastriggers as has_triggers
          FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename IN ('scores', 'player_achievements', 'achievements')
          ORDER BY tablename;
        `
      });

    if (realtimeError) {
      log('REALTIME', 'Table Configuration', 'WARNING',
          `Cannot check realtime configuration: ${realtimeError.message}`);
    } else {
      log('REALTIME', 'Table Configuration', 'INFO',
          'Table configuration for realtime',
          { tables: realtimeConfig });
    }

    // Note: Full realtime configuration check would require admin access
    log('REALTIME', 'Subscription Setup', 'INFO',
        'Frontend subscribes to player_achievements table for achievement notifications');

  } catch (err) {
    log('REALTIME', 'Realtime Check', 'FAIL', `Error: ${err}`);
  }
}

async function generateSummary() {
  console.log('\n📊 Summary Report\n');
  console.log('=' .repeat(80));

  const categories = [...new Set(results.map(r => r.category))];

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const passes = categoryResults.filter(r => r.status === 'PASS').length;
    const fails = categoryResults.filter(r => r.status === 'FAIL').length;
    const warnings = categoryResults.filter(r => r.status === 'WARNING').length;

    console.log(`\n${category}:`);
    console.log(`  ✅ Passed: ${passes}`);
    console.log(`  ❌ Failed: ${fails}`);
    console.log(`  ⚠️  Warnings: ${warnings}`);

    const criticalIssues = categoryResults.filter(r => r.status === 'FAIL');
    if (criticalIssues.length > 0) {
      console.log(`  Critical Issues:`);
      criticalIssues.forEach(issue => {
        console.log(`    - ${issue.test}: ${issue.message}`);
      });
    }
  }

  console.log('\n' + '=' .repeat(80));

  // Generate recommendations
  const criticalFailures = results.filter(r => r.status === 'FAIL');
  const warnings = results.filter(r => r.status === 'WARNING');

  console.log('\n🔧 RECOMMENDATIONS:\n');

  if (criticalFailures.length === 0) {
    console.log('✅ No critical issues found! The achievement system appears to be properly configured.');
  } else {
    console.log('❌ Critical issues found that need to be addressed:');
    criticalFailures.forEach(failure => {
      console.log(`   • ${failure.category} - ${failure.test}: ${failure.message}`);
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️ Warnings that should be investigated:');
    warnings.forEach(warning => {
      console.log(`   • ${warning.category} - ${warning.test}: ${warning.message}`);
    });
  }

  // Specific troubleshooting suggestions
  console.log('\n🔍 TROUBLESHOOTING SUGGESTIONS:\n');

  console.log('1. Check if users are authenticated when submitting scores');
  console.log('   - The current system requires user authentication for achievements');
  console.log('   - Anonymous users may not receive achievements');

  console.log('\n2. Verify database migration status');
  console.log('   - Ensure all achievement-related migrations have been applied');
  console.log('   - Check if there are conflicting migration versions');

  console.log('\n3. Test score submission flow');
  console.log('   - Submit a test score and monitor database logs');
  console.log('   - Check if triggers are firing properly');

  console.log('\n4. Monitor real-time subscriptions');
  console.log('   - Verify frontend is connected to proper channels');
  console.log('   - Check network connectivity and websocket status');

  console.log('\n5. Validate tournament and game data');
  console.log('   - Ensure scores are being submitted to active tournaments');
  console.log('   - Verify games are properly configured');
}

async function main() {
  console.log('🚀 Achievement System Debug Script\n');
  console.log('Investigating why achievement hunters are not getting achievements...\n');

  await checkDatabaseSchema();
  await checkSchemaConsistency();
  await checkExistingAchievements();
  await checkPlayerAchievements();
  await checkDatabaseTriggers();
  await checkRealtimeSubscriptions();
  await testAchievementSystem();

  await generateSummary();
}

// Run the debug script
main().catch(console.error);

export { main as debugAchievementSystem };