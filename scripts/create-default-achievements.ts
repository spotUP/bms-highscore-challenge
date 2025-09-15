import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function createDefaultAchievements() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🎯 Creating default achievements...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get the current tournament
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name')
      .limit(1);

    if (!tournaments || tournaments.length === 0) {
      console.error('❌ No tournaments found');
      return;
    }

    const tournamentId = tournaments[0].id;
    console.log(`🏆 Creating achievements for: ${tournaments[0].name}`);

    // Check if achievements already exist
    const { data: existing } = await supabase
      .from('achievements')
      .select('id, name')
      .eq('tournament_id', tournamentId);

    if (existing && existing.length > 0) {
      console.log(`ℹ️ Found ${existing.length} existing achievements:`, existing.map(a => a.name));
      console.log('Skipping creation...');
      return;
    }

    // Create default achievements based on the current schema
    const defaultAchievements = [
      {
        name: 'First Score',
        description: 'Submit your first score to any game',
        points: 10,
        tournament_id: tournamentId
      },
      {
        name: 'Century Club',
        description: 'Score 100 or more points in any game',
        points: 25,
        tournament_id: tournamentId
      },
      {
        name: 'High Scorer',
        description: 'Score 1,000 or more points in any game',
        points: 50,
        tournament_id: tournamentId
      },
      {
        name: 'Score Hunter',
        description: 'Score 10,000 or more points in any game',
        points: 100,
        tournament_id: tournamentId
      },
      {
        name: 'Perfect Game',
        description: 'Score 50,000 or more points in any game',
        points: 250,
        tournament_id: tournamentId
      },
      {
        name: 'Score Legend',
        description: 'Score 100,000 or more points in any game',
        points: 500,
        tournament_id: tournamentId
      }
    ];

    const { data: created, error: createError } = await supabase
      .from('achievements')
      .insert(defaultAchievements)
      .select();

    if (createError) {
      console.error('❌ Error creating achievements:', createError);
    } else {
      console.log(`✅ Successfully created ${created?.length} achievements:`);
      created?.forEach(ach => {
        console.log(`  🏅 ${ach.name} - ${ach.description} (${ach.points} points)`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createDefaultAchievements();