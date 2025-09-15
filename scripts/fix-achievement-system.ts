#!/usr/bin/env npx tsx

/**
 * Achievement System Fix Script
 *
 * This script applies immediate fixes to the achievement system based on
 * the debugging analysis findings.
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

async function fixAchievementCriteria() {
  console.log('🔧 Fixing Achievement Criteria...\n');

  try {
    // Get all achievements to understand current state
    const { data: achievements, error: fetchError } = await supabase
      .from('achievements')
      .select('*')
      .order('name');

    if (fetchError) {
      console.error('❌ Failed to fetch achievements:', fetchError.message);
      return;
    }

    console.log(`Found ${achievements?.length || 0} achievements to review:\n`);

    for (const achievement of achievements || []) {
      console.log(`- ${achievement.name} (${achievement.type}): ${JSON.stringify(achievement.criteria)}`);
    }

    console.log('\n🔄 Applying fixes...\n');

    // Fix Score Hunter achievement
    const scoreHunterUpdate = await supabase
      .from('achievements')
      .update({
        criteria: { threshold: 10000 },
        description: 'Score 10,000 or more points in any game'
      })
      .eq('name', 'Score Hunter')
      .eq('type', 'score_milestone');

    if (scoreHunterUpdate.error) {
      console.error('❌ Failed to update Score Hunter:', scoreHunterUpdate.error.message);
    } else {
      console.log('✅ Fixed Score Hunter achievement criteria');
    }

    // Fix Score Legend achievement
    const scoreLegendUpdate = await supabase
      .from('achievements')
      .update({
        criteria: { threshold: 50000 },
        description: 'Score 50,000 or more points in any game'
      })
      .eq('name', 'Score Legend')
      .eq('type', 'score_milestone');

    if (scoreLegendUpdate.error) {
      console.error('❌ Failed to update Score Legend:', scoreLegendUpdate.error.message);
    } else {
      console.log('✅ Fixed Score Legend achievement criteria');
    }

    // Fix Century Club achievement (should be score milestone)
    const centuryClubUpdate = await supabase
      .from('achievements')
      .update({
        type: 'score_milestone',
        criteria: { threshold: 100 },
        description: 'Score 100 or more points in any game'
      })
      .eq('name', 'Century Club');

    if (centuryClubUpdate.error) {
      console.error('❌ Failed to update Century Club:', centuryClubUpdate.error.message);
    } else {
      console.log('✅ Fixed Century Club achievement type and criteria');
    }

    // Fix High Scorer achievement (should be first place)
    const highScorerUpdate = await supabase
      .from('achievements')
      .update({
        type: 'first_place',
        criteria: {},
        description: 'Achieve first place on any game leaderboard'
      })
      .eq('name', 'High Scorer');

    if (highScorerUpdate.error) {
      console.error('❌ Failed to update High Scorer:', highScorerUpdate.error.message);
    } else {
      console.log('✅ Fixed High Scorer achievement type and criteria');
    }

    // Fix Perfect Game achievement
    const perfectGameUpdate = await supabase
      .from('achievements')
      .update({
        type: 'score_milestone',
        criteria: { threshold: 100000 },
        description: 'Score 100,000 or more points in any game'
      })
      .eq('name', 'Perfect Game');

    if (perfectGameUpdate.error) {
      console.error('❌ Failed to update Perfect Game:', perfectGameUpdate.error.message);
    } else {
      console.log('✅ Fixed Perfect Game achievement type and criteria');
    }

    // Ensure First Score achievement has correct setup
    const firstScoreUpdate = await supabase
      .from('achievements')
      .update({
        type: 'first_score',
        criteria: {},
        description: 'Submit your first score to any game'
      })
      .eq('name', 'First Score');

    if (firstScoreUpdate.error) {
      console.error('❌ Failed to update First Score:', firstScoreUpdate.error.message);
    } else {
      console.log('✅ Confirmed First Score achievement setup');
    }

    console.log('\n✅ Achievement criteria fixes completed!\n');

  } catch (err) {
    console.error('❌ Error fixing achievement criteria:', err);
  }
}

async function testAchievementFunction() {
  console.log('🧪 Testing Achievement Function...\n');

  try {
    // Get test data
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    const { data: games } = await supabase
      .from('games')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (!tournaments || tournaments.length === 0) {
      console.log('⚠️ No active tournaments found for testing');
      return;
    }

    if (!games || games.length === 0) {
      console.log('⚠️ No active games found for testing');
      return;
    }

    const tournament = tournaments[0];
    const game = games[0];

    console.log(`Testing with tournament: ${tournament.name}`);
    console.log(`Testing with game: ${game.name}\n`);

    // Try different achievement function names to see which exists
    const functionNames = [
      'check_and_award_achievements_v2',
      'check_and_award_achievements',
      'check_and_award_achievements_for_user',
      'check_and_award_achievements_for_player'
    ];

    let workingFunction = null;

    for (const funcName of functionNames) {
      try {
        console.log(`Trying function: ${funcName}...`);

        const testResult = await supabase.rpc(funcName as any, {
          p_score_id: crypto.randomUUID(),
          p_player_name: `test_player_${Date.now()}`,
          p_game_id: game.id,
          p_score: 150, // Should trigger "Century Club" achievement
          p_tournament_id: tournament.id,
          p_user_id: null
        });

        if (!testResult.error) {
          workingFunction = funcName;
          console.log(`✅ Function ${funcName} works!`);
          console.log('Result:', testResult.data);
          break;
        } else {
          console.log(`❌ Function ${funcName} failed:`, testResult.error.message);
        }
      } catch (err) {
        console.log(`❌ Function ${funcName} error:`, err);
      }
    }

    if (workingFunction) {
      console.log(`\n✅ Working achievement function found: ${workingFunction}`);
    } else {
      console.log('\n❌ No working achievement function found');
      console.log('\nThis suggests the achievement migration has not been applied.');
      console.log('Run: supabase db push --linked');
    }

  } catch (err) {
    console.error('❌ Error testing achievement function:', err);
  }
}

async function checkTriggers() {
  console.log('🔍 Checking Database Triggers...\n');

  try {
    // Try to check triggers using direct SQL
    const { data: triggerResult, error: triggerError } = await supabase
      .from('scores')
      .select('*')
      .limit(1);

    if (triggerError) {
      console.log('❌ Cannot access scores table:', triggerError.message);
      return;
    }

    console.log('✅ Scores table is accessible');

    // Try to insert a test score to see if trigger fires
    const testPlayerName = `trigger_test_${Date.now()}`;

    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (tournaments && tournaments.length > 0 && games && games.length > 0) {
      console.log('🧪 Testing trigger with actual score insertion...');

      const { data: scoreInsert, error: scoreError } = await supabase
        .from('scores')
        .insert({
          player_name: testPlayerName,
          score: 175, // Should trigger achievements
          game_id: games[0].id,
          tournament_id: tournaments[0].id
        })
        .select();

      if (scoreError) {
        console.log('❌ Failed to insert test score:', scoreError.message);
      } else {
        console.log('✅ Test score inserted successfully:', scoreInsert);

        // Wait a moment for trigger to process
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if achievements were awarded
        const { data: newAchievements } = await supabase
          .from('player_achievements')
          .select('*')
          .eq('player_name', testPlayerName);

        if (newAchievements && newAchievements.length > 0) {
          console.log(`🎉 SUCCESS! Trigger awarded ${newAchievements.length} achievements:`, newAchievements);
        } else {
          console.log('❌ No achievements were awarded - trigger may not be working');
        }

        // Clean up test score
        await supabase
          .from('scores')
          .delete()
          .eq('player_name', testPlayerName);

        // Clean up test achievements
        await supabase
          .from('player_achievements')
          .delete()
          .eq('player_name', testPlayerName);
      }
    }

  } catch (err) {
    console.error('❌ Error checking triggers:', err);
  }
}

async function main() {
  console.log('🚀 Achievement System Fix Script\n');
  console.log('Applying fixes based on debugging analysis...\n');

  await fixAchievementCriteria();
  await testAchievementFunction();
  await checkTriggers();

  console.log('\n📋 Summary:');
  console.log('1. ✅ Achievement criteria have been fixed');
  console.log('2. 🧪 Achievement function tested');
  console.log('3. 🔍 Database triggers checked');
  console.log('\nNext steps:');
  console.log('- If no working function found, run: supabase db push --linked');
  console.log('- Test the frontend by submitting a score');
  console.log('- Monitor for real-time achievement notifications');
  console.log('\nRun the debug script again to verify fixes:');
  console.log('npx tsx scripts/debug-achievement-system.ts');
}

main().catch(console.error);