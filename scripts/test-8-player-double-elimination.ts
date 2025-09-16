import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Copy the bracket generation logic from BracketContext
function createDoubleElimination(players: any[]) {
  const numPlayers = players.length;
  const matches: any[] = [];
  let matchId = 1;

  // Winners bracket
  const winnersRounds = Math.ceil(Math.log2(numPlayers));
  let currentRound = 1;
  let winnersMatchesThisRound = Math.ceil(numPlayers / 2);

  // Round 1 of winners bracket
  for (let i = 0; i < winnersMatchesThisRound; i++) {
    const participant1 = players[i * 2];
    const participant2 = players[i * 2 + 1] || null;

    matches.push({
      id: matchId++,
      round: currentRound,
      position: i + 1,
      participant1_id: participant1.id,
      participant2_id: participant2?.id || null,
      next_match_round: currentRound + 1,
      next_match_position: Math.floor(i / 2) + 1,
      loser_next_match_round: 100 + 1, // Losers round 1
      loser_next_match_position: i + 1
    });
  }

  // Subsequent winners rounds
  currentRound++;
  winnersMatchesThisRound = Math.ceil(winnersMatchesThisRound / 2);

  while (winnersMatchesThisRound >= 1) {
    for (let i = 0; i < winnersMatchesThisRound; i++) {
      const isLastWinnersRound = winnersMatchesThisRound === 1;
      matches.push({
        id: matchId++,
        round: currentRound,
        position: i + 1,
        participant1_id: null,
        participant2_id: null,
        next_match_round: isLastWinnersRound ? 1000 : currentRound + 1,
        next_match_position: isLastWinnersRound ? 1 : Math.floor(i / 2) + 1,
        loser_next_match_round: isLastWinnersRound ?
          (100 + (currentRound - 1) * 2 - 1) :
          (100 + (currentRound - 1) * 2 - 1)
      });
    }

    if (winnersMatchesThisRound === 1) break;
    currentRound++;
    winnersMatchesThisRound = Math.ceil(winnersMatchesThisRound / 2);
  }

  // Losers bracket
  const losersRounds = (winnersRounds - 1) * 2;
  let losersRound = 1;
  let losersMatchesThisRound = Math.ceil(numPlayers / 4);

  // Create losers bracket matches
  for (let round = 1; round <= losersRounds; round++) {
    const isEvenRound = round % 2 === 0;
    const matchCount = isEvenRound ?
      Math.ceil(losersMatchesThisRound / 2) :
      losersMatchesThisRound;

    for (let i = 0; i < matchCount; i++) {
      const isLastLosersRound = round === losersRounds;
      matches.push({
        id: matchId++,
        round: 100 + round,
        position: i + 1,
        participant1_id: null,
        participant2_id: null,
        next_match_round: isLastLosersRound ? 1000 : 100 + round + 1,
        next_match_position: isLastLosersRound ? 1 : (isEvenRound ? Math.floor(i / 2) + 1 : i + 1)
      });
    }

    if (!isEvenRound) {
      losersMatchesThisRound = Math.ceil(losersMatchesThisRound / 2);
    }
  }

  // Grand Final
  matches.push({
    id: matchId++,
    round: 1000,
    position: 1,
    participant1_id: null, // Winner of winners bracket
    participant2_id: null, // Winner of losers bracket
    next_match_round: null,
    next_match_position: null
  });

  return matches;
}

async function testDoubleElimination() {
  try {
    console.log('🧪 Testing 8-player double elimination bracket generation...\n');

    // Create 8 test players
    const players = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `Player ${i + 1}`
    }));

    console.log('👥 Players:');
    players.forEach(p => console.log(`  ${p.id}. ${p.name}`));
    console.log('');

    // Generate bracket
    const matches = createDoubleElimination(players);

    console.log(`🏆 Generated ${matches.length} matches\n`);

    // Analyze structure
    const matchesByRound: Record<number, any[]> = {};
    matches.forEach(match => {
      if (!matchesByRound[match.round]) {
        matchesByRound[match.round] = [];
      }
      matchesByRound[match.round].push(match);
    });

    const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

    console.log('🏆 WINNERS BRACKET:');
    const winnersRounds = rounds.filter(r => r >= 1 && r <= 99);
    winnersRounds.forEach(round => {
      const roundMatches = matchesByRound[round];
      console.log(`  Round ${round}: ${roundMatches.length} matches`);
      roundMatches.forEach(match => {
        console.log(`    Match ${match.position}: P${match.participant1_id || '?'} vs P${match.participant2_id || '?'} (ID: ${match.id})`);
        console.log(`      → Next: R${match.next_match_round}:${match.next_match_position}`);
        if (match.loser_next_match_round) {
          console.log(`      → Loser: R${match.loser_next_match_round}:${match.loser_next_match_position}`);
        }
      });
    });

    console.log('\n🥈 LOSERS BRACKET:');
    const losersRounds = rounds.filter(r => r >= 100 && r <= 999);
    losersRounds.forEach(round => {
      const roundMatches = matchesByRound[round];
      const losersRoundNum = round - 99;
      console.log(`  Losers Round ${losersRoundNum} (R${round}): ${roundMatches.length} matches`);
      roundMatches.forEach(match => {
        console.log(`    Match ${match.position}: P${match.participant1_id || '?'} vs P${match.participant2_id || '?'} (ID: ${match.id})`);
        console.log(`      → Next: R${match.next_match_round}:${match.next_match_position}`);
      });
    });

    console.log('\n🏆 FINALS:');
    const finalsRounds = rounds.filter(r => r >= 1000);
    finalsRounds.forEach(round => {
      const roundMatches = matchesByRound[round];
      const roundName = round === 1000 ? 'Grand Final' : `Round ${round}`;
      console.log(`  ${roundName} (R${round}): ${roundMatches.length} matches`);
      roundMatches.forEach(match => {
        console.log(`    Match ${match.position}: P${match.participant1_id || '?'} vs P${match.participant2_id || '?'} (ID: ${match.id})`);
      });
    });

    // Expected vs Actual
    console.log('\n📐 EXPECTED 8-PLAYER DOUBLE ELIMINATION:');
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
      console.log('\n⚠️  MISMATCH: Expected 14 matches but generated', matches.length);
    }

    // Check losers bracket flow
    console.log('\n🔍 LOSERS BRACKET FLOW ANALYSIS:');
    const expectedLosersStructure = [2, 2, 1, 1]; // For 8 players
    const actualLosersStructure = losersRounds.map(r => matchesByRound[r].length);

    console.log(`Expected: [${expectedLosersStructure.join(', ')}]`);
    console.log(`Actual:   [${actualLosersStructure.join(', ')}]`);

    if (JSON.stringify(expectedLosersStructure) !== JSON.stringify(actualLosersStructure)) {
      console.log('❌ LOSERS BRACKET STRUCTURE MISMATCH!');
    } else {
      console.log('✅ Losers bracket structure matches expected');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDoubleElimination();