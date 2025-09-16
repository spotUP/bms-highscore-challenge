import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTournamentMatches() {
  try {
    console.log('🔍 Debugging Test 5 tournament matches...\n');

    // Get the Test 5 tournament
    const { data: tournaments, error: tournamentError } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .ilike('name', '%test%5%');

    if (tournamentError) {
      console.error('❌ Error fetching tournaments:', tournamentError);
      return;
    }

    if (!tournaments || tournaments.length === 0) {
      console.log('❌ No tournament matching "Test 5" found');
      return;
    }

    const tournament = tournaments[0];
    console.log(`📋 Tournament: "${tournament.name}" (ID: ${tournament.id})`);
    console.log(`   Type: ${tournament.bracket_type}`);
    console.log(`   Status: ${tournament.status}\n`);

    // Get all matches for this tournament
    const { data: matches, error: matchError } = await supabase
      .from('bracket_matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('round', { ascending: true })
      .order('position', { ascending: true });

    if (matchError) {
      console.error('❌ Error fetching matches:', matchError);
      return;
    }

    if (!matches || matches.length === 0) {
      console.log('❌ No matches found for this tournament');
      return;
    }

    console.log(`📊 Found ${matches.length} matches:\n`);

    // Group matches by round
    const matchesByRound: Record<number, any[]> = {};
    matches.forEach(match => {
      if (!matchesByRound[match.round]) {
        matchesByRound[match.round] = [];
      }
      matchesByRound[match.round].push(match);
    });

    // Analyze bracket structure
    const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

    console.log('🏆 WINNERS BRACKET:');
    const winnersRounds = rounds.filter(r => r >= 1 && r <= 99);
    winnersRounds.forEach(round => {
      const roundMatches = matchesByRound[round];
      console.log(`  Round ${round}: ${roundMatches.length} matches`);
      roundMatches.forEach(match => {
        const hasWinner = match.winner_participant_id ? '✅' : '⏳';
        console.log(`    Match ${match.position}: ${hasWinner} (ID: ${match.id})`);
      });
    });

    console.log('\n🥈 LOSERS BRACKET:');
    const losersRounds = rounds.filter(r => r >= 100 && r <= 999);
    losersRounds.forEach(round => {
      const roundMatches = matchesByRound[round];
      const losersRoundNum = round - 99;
      console.log(`  Losers Round ${losersRoundNum} (R${round}): ${roundMatches.length} matches`);
      roundMatches.forEach(match => {
        const hasWinner = match.winner_participant_id ? '✅' : '⏳';
        console.log(`    Match ${match.position}: ${hasWinner} (ID: ${match.id})`);
      });
    });

    console.log('\n🏆 FINALS:');
    const finalsRounds = rounds.filter(r => r >= 1000);
    finalsRounds.forEach(round => {
      const roundMatches = matchesByRound[round];
      const roundName = round === 1000 ? 'Grand Final' : round === 1001 ? 'Bracket Reset' : `Round ${round}`;
      console.log(`  ${roundName} (R${round}): ${roundMatches.length} matches`);
      roundMatches.forEach(match => {
        const hasWinner = match.winner_participant_id ? '✅' : '⏳';
        const p1 = match.participant1_id ? 'P1' : '---';
        const p2 = match.participant2_id ? 'P2' : '---';
        console.log(`    Match ${match.position}: ${hasWinner} ${p1} vs ${p2} (ID: ${match.id})`);
      });
    });

    // Expected vs Actual structure for 8-player double elimination
    console.log('\n📐 EXPECTED 8-PLAYER DOUBLE ELIMINATION STRUCTURE:');
    console.log('  Winners: 3 rounds (4→2→1 matches)');
    console.log('  Losers: 4 rounds (2→2→1→1 matches)');
    console.log('  Finals: 1 round (1 match)');
    console.log('  Total: 14 matches');

    console.log('\n📊 ACTUAL STRUCTURE:');
    console.log(`  Winners: ${winnersRounds.length} rounds (${winnersRounds.map(r => matchesByRound[r].length).join('→')} matches)`);
    console.log(`  Losers: ${losersRounds.length} rounds (${losersRounds.map(r => matchesByRound[r].length).join('→')} matches)`);
    console.log(`  Finals: ${finalsRounds.length} rounds (${finalsRounds.map(r => matchesByRound[r].length).join('→')} matches)`);
    console.log(`  Total: ${matches.length} matches`);

    if (matches.length !== 14) {
      console.log('\n⚠️  MISMATCH: Expected 14 matches but found', matches.length);
    }

    // Check for issues
    console.log('\n🔍 POTENTIAL ISSUES:');
    let issuesFound = false;

    // Check Grand Final participants
    const grandFinal = matches.find(m => m.round === 1000);
    if (grandFinal) {
      if (!grandFinal.participant1_id && !grandFinal.participant2_id) {
        console.log('  ❌ Grand Final has no participants');
        issuesFound = true;
      } else if (!grandFinal.participant1_id || !grandFinal.participant2_id) {
        console.log('  ⚠️  Grand Final missing one participant');
        issuesFound = true;
      }
    } else {
      console.log('  ❌ No Grand Final found');
      issuesFound = true;
    }

    if (!issuesFound) {
      console.log('  ✅ No obvious structural issues found');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

debugTournamentMatches();