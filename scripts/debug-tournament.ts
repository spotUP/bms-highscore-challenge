import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugTournament() {
  console.log('=== Debugging Tournament Data ===\n');

  try {
    // Get the most recent double elimination tournament
    const { data: tournaments } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .eq('bracket_type', 'double')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!tournaments || tournaments.length === 0) {
      console.log('No double elimination tournaments found');
      return;
    }

    const tournament = tournaments[0];
    console.log('Tournament:', tournament.name, 'ID:', tournament.id);

    // Get players for this tournament
    const { data: players } = await supabase
      .from('bracket_players')
      .select('*')
      .eq('tournament_id', tournament.id);

    console.log(`\nPlayers (${players?.length || 0}):`, players);

    // Get matches for this tournament
    const { data: matches } = await supabase
      .from('bracket_matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('round')
      .order('position');

    console.log(`\nMatches (${matches?.length || 0}):`);
    matches?.forEach(match => {
      console.log(`Round ${match.round}, Position ${match.position}:`);
      console.log(`  Participant 1: ${match.participant1_id}`);
      console.log(`  Participant 2: ${match.participant2_id}`);
      console.log(`  Winner: ${match.winner_participant_id}`);
    });

    // Check if participant IDs match player IDs
    console.log('\n=== Data Validation ===');
    const playerIds = players?.map(p => p.id) || [];
    const matchParticipants = matches?.flatMap(m => [m.participant1_id, m.participant2_id]).filter(Boolean) || [];

    console.log('Player IDs:', playerIds);
    console.log('Match participant IDs:', matchParticipants);

    const missingPlayers = matchParticipants.filter(pid => !playerIds.includes(pid));
    if (missingPlayers.length > 0) {
      console.log('❌ Missing player data for IDs:', missingPlayers);
    } else {
      console.log('✅ All participant IDs have corresponding player data');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugTournament().catch(console.error);