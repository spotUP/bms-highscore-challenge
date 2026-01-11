#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testAchievementSystem() {
  console.log('🧪 Testing achievement system...');

  try {
    // Get current tournament
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (!tournaments || tournaments.length === 0) {
      console.log('❌ No active tournament found');
      return;
    }

    const tournament = tournaments[0];
    console.log(`🎯 Tournament: ${tournament.name}`);

    // Test anonymous RPC function
    console.log('🔍 Testing anonymous achievement lookup...');
    const { data: anonymousAchievements, error: anonError } = await supabase
      .rpc('get_recent_achievements_by_tournament', {
        p_tournament_id: tournament.id,
        p_player_name: 'TESTPLAYER',
        p_since_minutes: 60
      });

    if (anonError) {
      console.log('❌ Anonymous RPC failed:', anonError.message);
    } else {
      console.log('✅ Anonymous RPC works! Found', anonymousAchievements?.length || 0, 'achievements');
    }

    // Test manual achievement award
    console.log('🏆 Testing manual achievement award...');

    // Get first achievement
    const { data: firstAchievement } = await supabase
      .from('achievements')
      .select('*')
      .eq('tournament_id', tournament.id)
      .limit(1)
      .single();

    if (firstAchievement) {
      // Try to award achievement to test player
      const { data: awardResult, error: awardError } = await supabase
        .rpc('award_achievement_to_player', {
          p_player_name: 'TESTPLAYER',
          p_tournament_id: tournament.id,
          p_achievement_id: firstAchievement.id
        });

      if (awardError) {
        console.log('❌ Manual award failed:', awardError.message);
      } else {
        console.log('✅ Manual award result:', awardResult);

        // Now test if we can find the awarded achievement
        const { data: foundAchievements, error: findError } = await supabase
          .rpc('get_recent_achievements_by_tournament', {
            p_tournament_id: tournament.id,
            p_player_name: 'TESTPLAYER',
            p_since_minutes: 5
          });

        if (findError) {
          console.log('❌ Could not find awarded achievement:', findError.message);
        } else {
          console.log('✅ Found', foundAchievements?.length || 0, 'recent achievements for TESTPLAYER');
          if (foundAchievements && foundAchievements.length > 0) {
            console.log('🎉 Achievement notification should appear:', foundAchievements[0]);
          }
        }
      }
    }

    // List all achievements for this tournament
    const { data: allAchievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('tournament_id', tournament.id);

    console.log(`📊 Total achievements available: ${allAchievements?.length || 0}`);
    allAchievements?.forEach((ach, i) => {
      console.log(`  ${i + 1}. ${ach.name} (${ach.points} pts) - ${ach.description}`);
    });

    console.log('🎯 Achievement system test complete!');
    console.log('💡 Try submitting a real score to see if notifications appear automatically.');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testAchievementSystem();