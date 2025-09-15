import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixTournamentBracket() {
  console.log('=== Fixing Tournament Bracket ===\n');

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
    console.log('Fixing tournament:', tournament.name, 'ID:', tournament.id);

    // Get players for this tournament
    const { data: players } = await supabase
      .from('bracket_players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('created_at');

    if (!players || players.length === 0) {
      console.log('No players found');
      return;
    }

    console.log(`Players: ${players.map(p => p.name).join(', ')}`);

    // Delete existing matches
    await supabase
      .from('bracket_matches')
      .delete()
      .eq('tournament_id', tournament.id);

    console.log('Deleted existing matches');

    // Regenerate bracket with proper player assignments
    const playerCount = players.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(playerCount)));
    const totalWinnersRounds = Math.log2(bracketSize);

    console.log(`Bracket size: ${bracketSize}, Winners rounds: ${totalWinnersRounds}`);

    // Create seeded bracket with byes
    const seededPlayers = new Array(bracketSize).fill(null);
    for (let i = 0; i < players.length; i++) {
      seededPlayers[i] = players[i];
    }

    const matches = [];

    // 1. WINNERS BRACKET ROUND 1: Assign players
    let position = 1;
    for (let i = 0; i < seededPlayers.length; i += 2) {
      matches.push({
        tournament_id: tournament.id,
        round: 1,
        position: position++,
        participant1_id: seededPlayers[i]?.id || null,
        participant2_id: seededPlayers[i + 1]?.id || null,
        winner_participant_id: null
      });
    }

    // 2. WINNERS BRACKET SUBSEQUENT ROUNDS: Empty for now
    for (let round = 2; round <= totalWinnersRounds; round++) {
      const matchesInRound = Math.pow(2, totalWinnersRounds - round);
      for (let pos = 1; pos <= matchesInRound; pos++) {
        matches.push({
          tournament_id: tournament.id,
          round: round,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
    }

    // 3. LOSERS BRACKET: Create structure based on bracket size
    if (bracketSize > 2) {
      // For 4-player bracket: need 2 losers rounds (100, 101)
      const firstLosersRound = 100;
      const losersRounds = totalWinnersRounds - 1;

      for (let round = firstLosersRound; round < firstLosersRound + losersRounds; round++) {
        const matchesInRound = round === firstLosersRound ? bracketSize / 4 : Math.max(1, Math.pow(2, firstLosersRound + losersRounds - round - 1));
        for (let pos = 1; pos <= matchesInRound; pos++) {
          matches.push({
            tournament_id: tournament.id,
            round: round,
            position: pos,
            participant1_id: null,
            participant2_id: null,
            winner_participant_id: null
          });
        }
      }
    }

    // 4. GRAND FINAL
    matches.push({
      tournament_id: tournament.id,
      round: 1000,
      position: 1,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });

    // Insert all matches
    const { error } = await supabase
      .from('bracket_matches')
      .insert(matches);

    if (error) throw error;

    console.log(`Created ${matches.length} matches`);

    // Show the first round matches to verify player assignment
    const firstRoundMatches = matches.filter(m => m.round === 1);
    console.log('\nFirst round pairings:');
    firstRoundMatches.forEach((match, idx) => {
      const p1 = match.participant1_id ?
        players.find(p => p.id === match.participant1_id)?.name || 'Unknown' : 'BYE';
      const p2 = match.participant2_id ?
        players.find(p => p.id === match.participant2_id)?.name || 'Unknown' : 'BYE';
      console.log(`  Match ${idx + 1}: ${p1} vs ${p2}`);
    });

    console.log('\n✅ Tournament bracket fixed!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixTournamentBracket().catch(console.error);