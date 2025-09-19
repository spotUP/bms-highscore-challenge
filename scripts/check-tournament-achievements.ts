import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTournamentAchievements() {
  console.log('🏆 Checking tournament achievements...');

  try {
    // Get all tournaments (including inactive ones)
    console.log('📋 Fetching all tournaments...');
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, slug, is_active, created_at')
      .order('created_at', { ascending: false });

    if (tournamentsError) {
      console.error('❌ Error fetching tournaments:', tournamentsError);
      return;
    }

    console.log(`✅ Found ${tournaments?.length || 0} tournaments:`);
    tournaments?.forEach(tournament => {
      console.log(`  - ${tournament.name} (${tournament.slug}) - Active: ${tournament.is_active} - ID: ${tournament.id}`);
    });

    // Check achievements for each tournament
    console.log('\n🎯 Checking achievements per tournament...');

    for (const tournament of tournaments || []) {
      console.log(`\n--- ${tournament.name} (${tournament.slug}) ---`);

      const { data: achievements, error: achievementsError } = await supabase
        .from('achievements')
        .select('id, name, description, type, points, is_active, created_by')
        .eq('tournament_id', tournament.id)
        .eq('is_active', true);

      if (achievementsError) {
        console.error(`❌ Error fetching achievements for ${tournament.name}:`, achievementsError);
        continue;
      }

      if (achievements && achievements.length > 0) {
        console.log(`✅ Found ${achievements.length} active achievements:`);
        achievements.forEach(achievement => {
          console.log(`  - ${achievement.name} (${achievement.type}) - ${achievement.points} pts - Created by: ${achievement.created_by || 'System'}`);
        });
      } else {
        console.log(`❌ No achievements found for ${tournament.name}`);
      }
    }

    // Find the favorites tournament specifically
    const favoritesTournament = tournaments?.find(t => t.slug === 'favorites' || t.name.toLowerCase().includes('favorites'));
    if (favoritesTournament) {
      console.log(`\n🌟 Favorites tournament found: ${favoritesTournament.name} (ID: ${favoritesTournament.id})`);
      return favoritesTournament.id;
    } else {
      console.log('\n❌ No favorites tournament found');
      return null;
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTournamentAchievements().then(favoritesId => {
  if (favoritesId) {
    console.log(`\n✅ Favorites tournament ID: ${favoritesId}`);
  }
}).catch(console.error);