import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugBracketDisplay() {
  console.log('=== Debugging Bracket Display ===\n');

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

    console.log(`\nPlayers (${players?.length || 0}):`);
    players?.forEach(p => {
      console.log(`  ID: ${p.id}, Name: "${p.name}"`);
    });

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
      console.log(`  Participant 1 ID: ${match.participant1_id}`);
      console.log(`  Participant 2 ID: ${match.participant2_id}`);
      console.log(`  Winner ID: ${match.winner_participant_id}`);

      // Show player names for each participant
      const p1 = players?.find(p => p.id === match.participant1_id);
      const p2 = players?.find(p => p.id === match.participant2_id);
      console.log(`  Participant 1 Name: ${p1?.name || 'NOT FOUND'}`);
      console.log(`  Participant 2 Name: ${p2?.name || 'NOT FOUND'}`);
      console.log('');
    });

    // Simulate what the Competition component would do
    console.log('\n=== Simulating Competition Component Participant Map ===');
    const participantMap: Record<string, any> = {};
    if (players && Array.isArray(players)) {
      players.forEach(p => {
        participantMap[p.id] = {
          id: p.id,
          display_name: p.name,
          name: p.name
        };
      });
    }

    console.log('Participant Map Keys:', Object.keys(participantMap));
    console.log('Participant Map Values:');
    Object.entries(participantMap).forEach(([id, participant]) => {
      console.log(`  ${id}: ${JSON.stringify(participant)}`);
    });

    // Test participant lookup like BracketView would do
    console.log('\n=== Testing BracketView Participant Lookup ===');
    matches?.slice(0, 2).forEach(match => {
      console.log(`Match ${match.round}-${match.position}:`);
      const p1 = match.participant1_id ? participantMap[match.participant1_id] : undefined;
      const p2 = match.participant2_id ? participantMap[match.participant2_id] : undefined;

      console.log(`  P1 lookup: ${match.participant1_id} -> ${p1 ? p1.display_name : 'NOT FOUND'}`);
      console.log(`  P2 lookup: ${match.participant2_id} -> ${p2 ? p2.display_name : 'NOT FOUND'}`);
    });

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugBracketDisplay().catch(console.error);