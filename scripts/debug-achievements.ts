import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAchievements() {
  console.log('🔍 Debugging Achievement System...\n');

  try {
    // 1. Check if there are any achievements defined
    const { data: achievements, error: achError } = await supabase
      .from('achievements')
      .select('*')
      .limit(5);

    if (achError) {
      console.error('❌ Error fetching achievements:', achError);
    } else {
      console.log(`✅ Found ${achievements?.length || 0} achievements in the database`);
      if (achievements && achievements.length > 0) {
        console.log('Sample achievements:', achievements.slice(0, 2).map(a => ({
          name: a.name,
          type: a.type,
          is_active: a.is_active
        })));
      }
    }

    // 2. Check if there are any player achievements
    const { data: playerAchievements, error: paError } = await supabase
      .from('player_achievements')
      .select('*')
      .limit(10);

    if (paError) {
      console.error('❌ Error fetching player achievements:', paError);
    } else {
      console.log(`\n✅ Found ${playerAchievements?.length || 0} player achievements`);
      if (playerAchievements && playerAchievements.length > 0) {
        // Group by player
        const byPlayer = playerAchievements.reduce((acc, pa) => {
          acc[pa.player_name] = (acc[pa.player_name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('Player achievement counts:', byPlayer);
      }
    }

    // 3. Check if triggers exist
    const { data: triggers, error: trigError } = await supabase.rpc('get_database_triggers' as any);

    if (!trigError && triggers) {
      const achTriggers = triggers.filter((t: any) =>
        t.trigger_name?.includes('achievement') ||
        t.event_object_table === 'scores'
      );
      console.log(`\n✅ Found ${achTriggers.length} achievement-related triggers`);
      achTriggers.forEach((t: any) => {
        console.log(`  - ${t.trigger_name} on ${t.event_object_table}`);
      });
    } else {
      // Try alternative method
      const { data: checkFunc, error: funcError } = await supabase.rpc('check_and_award_achievements' as any, {
        p_score_id: '00000000-0000-0000-0000-000000000000',
        p_player_name: 'TEST',
        p_game_id: '00000000-0000-0000-0000-000000000000',
        p_score: 0,
        p_tournament_id: '00000000-0000-0000-0000-000000000000',
        p_user_id: null
      });

      if (!funcError) {
        console.log('\n✅ Achievement check function exists and is callable');
      } else {
        console.log('\n⚠️ Achievement check function may not exist or has issues:', funcError.message);
      }
    }

    // 4. Check recent scores to see if they should have triggered achievements
    const { data: recentScores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!scoresError && recentScores && recentScores.length > 0) {
      console.log(`\n📊 Recent scores that should trigger achievements:`);
      recentScores.forEach(score => {
        console.log(`  - ${score.player_name}: ${score.score} points (${new Date(score.created_at).toLocaleString()})`);
      });

      // Check if first_score achievement should have been awarded
      const playerNames = [...new Set(recentScores.map(s => s.player_name))];
      for (const playerName of playerNames) {
        const { data: playerAch, error } = await supabase
          .from('player_achievements')
          .select('*')
          .eq('player_name', playerName)
          .limit(1);

        if (!error) {
          if (!playerAch || playerAch.length === 0) {
            console.log(`  ⚠️ ${playerName} has scores but no achievements!`);
          }
        }
      }
    }

    // 5. Test if we can manually insert a player achievement
    console.log('\n🧪 Testing manual achievement insertion...');
    const testAchievement = {
      player_name: 'TEST_PLAYER',
      achievement_id: achievements?.[0]?.id,
      tournament_id: achievements?.[0]?.tournament_id,
      earned_at: new Date().toISOString()
    };

    if (testAchievement.achievement_id && testAchievement.tournament_id) {
      const { error: insertError } = await supabase
        .from('player_achievements')
        .insert([testAchievement]);

      if (insertError) {
        console.log('❌ Could not insert test achievement:', insertError.message);
      } else {
        console.log('✅ Successfully inserted test achievement');

        // Clean up
        await supabase
          .from('player_achievements')
          .delete()
          .eq('player_name', 'TEST_PLAYER');
      }
    }

  } catch (error) {
    console.error('Error during debugging:', error);
  }
}

// Add RPC function to get triggers if it doesn't exist
async function ensureGetTriggersFunction() {
  const functionSQL = `
    CREATE OR REPLACE FUNCTION get_database_triggers()
    RETURNS TABLE(
      trigger_name text,
      event_object_table text,
      event_manipulation text
    )
    LANGUAGE sql
    SECURITY DEFINER
    AS $$
      SELECT
        trigger_name::text,
        event_object_table::text,
        event_manipulation::text
      FROM information_schema.triggers
      WHERE trigger_schema = 'public';
    $$;
  `;

  try {
    await supabase.rpc('exec_sql' as any, { sql: functionSQL });
  } catch (e) {
    // Function might already exist or exec_sql might not be available
  }
}

debugAchievements().then(() => {
  console.log('\n✨ Achievement system debugging complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});