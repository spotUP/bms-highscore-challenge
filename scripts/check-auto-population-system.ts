import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAutoPopulationSystem() {
  console.log('🔍 Checking auto-population system status...');

  try {
    // Check if there are template achievements (tournament_id IS NULL)
    const { data: templates, error: templateError } = await supabase
      .from('achievements')
      .select('id, name, tournament_id')
      .is('tournament_id', null);

    if (templateError) {
      console.error('❌ Error checking template achievements:', templateError);
    } else {
      console.log(`📋 Template achievements (tournament_id IS NULL): ${templates?.length || 0}`);
      if (templates && templates.length > 0) {
        templates.forEach(t => console.log(`  - ${t.name}`));
      } else {
        console.log('⚠️ No template achievements found - auto-population will not work!');
      }
    }

    // Check all tournaments and their achievement counts
    const { data: tournaments, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, is_active');

    if (tournamentError) {
      console.error('❌ Error checking tournaments:', tournamentError);
      return;
    }

    console.log(`\n🏆 Found ${tournaments?.length || 0} tournaments:`);

    if (tournaments) {
      for (const tournament of tournaments) {
        const { data: achievements, error: achError } = await supabase
          .from('achievements')
          .select('id, name')
          .eq('tournament_id', tournament.id);

        if (achError) {
          console.error(`❌ Error checking achievements for ${tournament.name}:`, achError);
        } else {
          const status = tournament.is_active ? '✅' : '❌';
          console.log(`  ${status} ${tournament.name}: ${achievements?.length || 0} achievements`);
        }
      }
    }

    // Test if we can manually trigger the auto-population
    console.log('\n🧪 Testing auto-population system...');

    if (templates && templates.length > 0 && tournaments && tournaments.length > 0) {
      // Find a tournament that might not have achievements
      const testTournament = tournaments.find(t => t.name.includes('Favorites') || t.name.includes('Default'));

      if (testTournament) {
        console.log(`Testing with tournament: ${testTournament.name}`);

        // Try to call the populate function manually
        const { data: result, error: populateError } = await supabase
          .rpc('populate_default_achievements', { p_tournament_id: testTournament.id });

        if (populateError) {
          console.error('❌ Error calling populate_default_achievements:', populateError);
          console.log('💡 This suggests the auto-population system is not installed');
        } else {
          console.log('✅ Auto-population function executed successfully');

          // Check if achievements were added
          const { data: newAchievements } = await supabase
            .from('achievements')
            .select('id, name')
            .eq('tournament_id', testTournament.id);

          console.log(`🎯 Tournament now has ${newAchievements?.length || 0} achievements`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAutoPopulationSystem().catch(console.error);