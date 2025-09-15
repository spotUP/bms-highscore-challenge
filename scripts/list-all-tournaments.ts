import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listAllTournaments() {
  console.log('=== All Double Elimination Tournaments ===\n');

  try {
    const { data: tournaments } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .eq('bracket_type', 'double')
      .order('created_at', { ascending: false });

    if (!tournaments || tournaments.length === 0) {
      console.log('No double elimination tournaments found');
      return;
    }

    for (const tournament of tournaments) {
      console.log(`ID: ${tournament.id}`);
      console.log(`Name: ${tournament.name}`);
      console.log(`Created: ${tournament.created_at}`);

      // Check match assignments
      const { data: matches } = await supabase
        .from('bracket_matches')
        .select('participant1_id, participant2_id, round, position')
        .eq('tournament_id', tournament.id)
        .not('participant1_id', 'is', null)
        .limit(5);

      const hasAssignments = matches && matches.length > 0;
      console.log(`Has player assignments: ${hasAssignments ? 'YES' : 'NO'}`);

      if (hasAssignments) {
        console.log('Sample assignments:');
        matches?.forEach(m => {
          console.log(`  Round ${m.round}, Position ${m.position}: ${m.participant1_id} vs ${m.participant2_id}`);
        });
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ List failed:', error);
  }
}

listAllTournaments().catch(console.error);