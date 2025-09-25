import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function debugBracketData() {
  console.log('=== Debugging Bracket Data ===\n');

  // Get all tournaments (both single and double)
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('bracket_tournaments')
    .select('*');

  if (tournamentsError) {
    console.error('Error fetching tournaments:', tournamentsError);
    return;
  }

  console.log(`Found ${tournaments?.length || 0} tournaments:`);
  tournaments?.forEach(t => {
    console.log(`  - ${t.name} (${t.bracket_type} elimination) - Status: ${t.status}`);
  });

  if (!tournaments || tournaments.length === 0) {
    console.log('No tournaments found.');
    return;
  }

  for (const tournament of tournaments) {
    console.log(`\n--- Tournament: ${tournament.name} (${tournament.id}) ---`);

    // Get players
    const { data: players, error: playersError } = await supabase
      .from('bracket_players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('seed', { ascending: true });

    if (playersError) {
      console.error(`Error fetching players for ${tournament.name}:`, playersError);
      continue;
    }

    console.log(`Players (${players?.length || 0}):`);
    players?.forEach(player => {
      console.log(`  - ${player.name} (ID: ${player.id}, Seed: ${player.seed})`);
    });

    // Get matches
    const { data: matches, error: matchesError } = await supabase
      .from('bracket_matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('round', { ascending: true })
      .order('position', { ascending: true });

    if (matchesError) {
      console.error(`Error fetching matches for ${tournament.name}:`, matchesError);
      continue;
    }

    console.log(`\nMatches (${matches?.length || 0}):`);

    // Group matches by round
    const matchesByRound = matches?.reduce((acc, match) => {
      const roundKey = match.round >= 1000 ? 'Grand Finals' :
                      match.round >= 100 ? `Losers R${match.round - 99}` :
                      `Winners R${match.round}`;

      if (!acc[roundKey]) acc[roundKey] = [];
      acc[roundKey].push(match);
      return acc;
    }, {} as Record<string, any[]>) || {};

    Object.entries(matchesByRound).forEach(([roundName, roundMatches]) => {
      console.log(`  ${roundName}:`);
      roundMatches.forEach(match => {
        const p1Name = players?.find(p => p.id === match.participant1_id)?.name || '—';
        const p2Name = players?.find(p => p.id === match.participant2_id)?.name || '—';
        const winnerName = match.winner_participant_id ?
          players?.find(p => p.id === match.winner_participant_id)?.name || 'Unknown' :
          'TBD';

        console.log(`    Match ${match.position}: ${p1Name} vs ${p2Name} | Winner: ${winnerName}`);
        console.log(`      IDs: ${match.participant1_id || 'null'} vs ${match.participant2_id || 'null'}`);
      });
    });
  }
}

debugBracketData().catch(console.error);