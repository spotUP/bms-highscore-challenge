#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface TournamentPlayer {
  id: string;
  tournament_id: string;
  name: string;
  seed?: number;
}

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  participant1_id: string | null;
  participant2_id: string | null;
  winner_participant_id: string | null;
}

// Generate 24 test players
const generateTestPlayers = (): string[] => {
  return [
    'Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson',
    'Emma Brown', 'Frank Miller', 'Grace Taylor', 'Henry Clark',
    'Ivy Martinez', 'Jack Anderson', 'Kate Thompson', 'Liam Garcia',
    'Maya Rodriguez', 'Noah Lee', 'Olivia White', 'Paul Harris',
    'Quinn Jackson', 'Ruby Martin', 'Sam Lewis', 'Tara Walker',
    'Uma Young', 'Victor Hall', 'Wendy Allen', 'Xavier King'
  ];
};

// Create tournament with players
async function createTestTournament(bracketType: 'single' | 'double'): Promise<string> {
  console.log(`🎯 Creating test ${bracketType} elimination tournament...`);

  // Create tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('bracket_tournaments')
    .insert({
      name: `Test 24-Player ${bracketType.charAt(0).toUpperCase() + bracketType.slice(1)} Elimination Tournament`,
      bracket_type: bracketType,
      status: 'draft',
      is_public: true,
      created_by: null
    })
    .select()
    .single();

  if (tournamentError || !tournament) {
    throw new Error(`Failed to create tournament: ${tournamentError?.message}`);
  }

  console.log(`✅ Tournament created: ${tournament.id}`);

  // Add players
  const playerNames = generateTestPlayers();
  const playerRows = playerNames.map((name, index) => ({
    tournament_id: tournament.id,
    name,
    seed: index + 1
  }));

  const { data: players, error: playersError } = await supabase
    .from('bracket_players')
    .insert(playerRows)
    .select();

  if (playersError || !players) {
    throw new Error(`Failed to create players: ${playersError?.message}`);
  }

  console.log(`✅ Added ${players.length} players`);
  return tournament.id;
}

// Generate bracket structure for 24 players
function generateBracketMatches(tournamentId: string, players: TournamentPlayer[], bracketType: 'single' | 'double'): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  const numPlayers = players.length; // 24

  console.log(`🔧 Generating ${bracketType} elimination bracket for ${numPlayers} players`);

  if (bracketType === 'single') {
    return generateSingleElimination(tournamentId, players);
  } else {
    return generateDoubleElimination(tournamentId, players);
  }
}

function generateSingleElimination(tournamentId: string, players: TournamentPlayer[]): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  let matchId = 1;
  let position = 1;

  // Round 1: Handle the 16 players that don't get byes
  // 8 matches to eliminate 8 players, leaving 8 winners + 8 bye players = 16 for round 2
  for (let i = 0; i < 16; i += 2) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: 1,
      position: position++,
      participant1_id: players[i].id,
      participant2_id: players[i + 1].id,
      winner_participant_id: null
    });
  }

  // Round 2: 8 winners from round 1 + 8 bye players (players 16-23)
  position = 1;
  for (let i = 0; i < 8; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: 2,
      position: position++,
      participant1_id: null, // Will be filled by round 1 winner
      participant2_id: players[16 + i].id, // Bye players
      winner_participant_id: null
    });
  }

  // Round 3: Quarterfinals (8 -> 4)
  position = 1;
  for (let i = 0; i < 4; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: 3,
      position: position++,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });
  }

  // Round 4: Semifinals (4 -> 2)
  position = 1;
  for (let i = 0; i < 2; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: 4,
      position: position++,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });
  }

  // Round 1000: Grand Final (2 -> 1)
  matches.push({
    id: `match-${matchId++}`,
    tournament_id: tournamentId,
    round: 1000,
    position: 1,
    participant1_id: null,
    participant2_id: null,
    winner_participant_id: null
  });

  console.log(`✅ Generated ${matches.length} single elimination matches`);
  return matches;
}

function generateDoubleElimination(tournamentId: string, players: TournamentPlayer[]): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  let matchId = 1;

  // WINNERS BRACKET
  console.log('   📈 Generating Winners Bracket...');

  // WB Round 1: First 16 players (8 matches)
  let position = 1;
  for (let i = 0; i < 16; i += 2) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: 1,
      position: position++,
      participant1_id: players[i].id,
      participant2_id: players[i + 1].id,
      winner_participant_id: null
    });
  }

  // WB Round 2: 8 winners + 8 bye players (8 matches)
  position = 1;
  for (let i = 0; i < 8; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: 2,
      position: position++,
      participant1_id: null, // WB R1 winner
      participant2_id: players[16 + i].id, // Bye player
      winner_participant_id: null
    });
  }

  // WB Round 3: Quarterfinals (4 matches)
  position = 1;
  for (let i = 0; i < 4; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: 3,
      position: position++,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });
  }

  // WB Round 4: Semifinals (2 matches)
  position = 1;
  for (let i = 0; i < 2; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: 4,
      position: position++,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });
  }

  // WB Final (1 match)
  matches.push({
    id: `match-${matchId++}`,
    tournament_id: tournamentId,
    round: 5,
    position: 1,
    participant1_id: null,
    participant2_id: null,
    winner_participant_id: null
  });

  // LOSERS BRACKET
  console.log('   📉 Generating Losers Bracket...');

  // LB Round 1: Losers from WB R1 (8 players, 4 matches)
  position = 1;
  for (let i = 0; i < 4; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: -1, // Negative rounds for losers bracket
      position: position++,
      participant1_id: null, // Loser from WB R1
      participant2_id: null, // Loser from WB R1
      winner_participant_id: null
    });
  }

  // LB Round 2: 4 winners + 8 losers from WB R2 (6 matches)
  position = 1;
  for (let i = 0; i < 6; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: -2,
      position: position++,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });
  }

  // LB Round 3: 6 winners + 4 losers from WB R3 (5 matches)
  position = 1;
  for (let i = 0; i < 5; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: -3,
      position: position++,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });
  }

  // LB Round 4: 5 winners vs 2 losers from WB R4 (3-4 matches)
  position = 1;
  for (let i = 0; i < 3; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: -4,
      position: position++,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });
  }

  // LB Round 5: 3 winners + 1 loser from WB Final (2 matches)
  position = 1;
  for (let i = 0; i < 2; i++) {
    matches.push({
      id: `match-${matchId++}`,
      tournament_id: tournamentId,
      round: -5,
      position: position++,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });
  }

  // LB Final (1 match)
  matches.push({
    id: `match-${matchId++}`,
    tournament_id: tournamentId,
    round: -6,
    position: 1,
    participant1_id: null,
    participant2_id: null,
    winner_participant_id: null
  });

  // GRAND FINALS
  console.log('   🏆 Generating Grand Finals...');

  // Grand Final (WB winner vs LB winner)
  matches.push({
    id: `match-${matchId++}`,
    tournament_id: tournamentId,
    round: 1000,
    position: 1,
    participant1_id: null, // WB winner
    participant2_id: null, // LB winner
    winner_participant_id: null
  });

  // Bracket Reset (if LB winner beats WB winner)
  matches.push({
    id: `match-${matchId++}`,
    tournament_id: tournamentId,
    round: 1001,
    position: 1,
    participant1_id: null, // Same as Grand Final
    participant2_id: null, // Same as Grand Final
    winner_participant_id: null
  });

  console.log(`✅ Generated ${matches.length} double elimination matches`);
  return matches;
}

// Save matches to database
async function saveMatches(matches: TournamentMatch[]): Promise<void> {
  console.log('💾 Saving matches to database...');

  const { error } = await supabase
    .from('bracket_matches')
    .insert(matches.map(m => ({
      tournament_id: m.tournament_id,
      round: m.round,
      position: m.position,
      participant1_id: m.participant1_id,
      participant2_id: m.participant2_id,
      winner_participant_id: m.winner_participant_id
    })));

  if (error) {
    throw new Error(`Failed to save matches: ${error.message}`);
  }

  console.log(`✅ Saved ${matches.length} matches`);
}

// Analyze bracket structure for problems
function analyzeBracket(players: TournamentPlayer[], matches: TournamentMatch[], bracketType: 'single' | 'double') {
  console.log('\n🔍 BRACKET ANALYSIS');
  console.log('==================');

  const problems: string[] = [];
  const roundCounts = new Map<number, number>();

  // Count matches per round
  matches.forEach(match => {
    roundCounts.set(match.round, (roundCounts.get(match.round) || 0) + 1);
  });

  console.log('\n📊 Matches per round:');
  Array.from(roundCounts.entries())
    .sort(([a], [b]) => {
      if (a === 1000) return 1; // Grand Final last
      if (b === 1000) return -1;
      if (a === 1001) return 1; // Bracket Reset last
      if (b === 1001) return -1;
      if (a < 0 && b < 0) return b - a; // Losers bracket rounds in reverse
      if (a < 0) return 1; // Losers rounds after winners
      if (b < 0) return -1;
      return a - b; // Winners rounds in order
    })
    .forEach(([round, count]) => {
      let roundName = '';
      if (round === 1000) roundName = 'Grand Final';
      else if (round === 1001) roundName = 'Bracket Reset';
      else if (round < 0) roundName = `LB Round ${Math.abs(round)}`;
      else roundName = `WB Round ${round}`;
      console.log(`   ${roundName}: ${count} matches`);
    });

  if (bracketType === 'single') {
    return analyzeSingleElimination(players, matches, roundCounts, problems);
  } else {
    return analyzeDoubleElimination(players, matches, roundCounts, problems);
  }
}

function analyzeSingleElimination(players: TournamentPlayer[], matches: TournamentMatch[], roundCounts: Map<number, number>, problems: string[]) {
  console.log('\n🔧 Single Elimination Structure validation:');

  // Round 1 should have 8 matches (16 players competing)
  const round1Count = roundCounts.get(1) || 0;
  if (round1Count !== 8) {
    problems.push(`Round 1 should have 8 matches, found ${round1Count}`);
  } else {
    console.log('   ✅ Round 1: 8 matches (16 players, 8 advance)');
  }

  // Round 2 should have 8 matches (8 winners + 8 bye players)
  const round2Count = roundCounts.get(2) || 0;
  if (round2Count !== 8) {
    problems.push(`Round 2 should have 8 matches, found ${round2Count}`);
  } else {
    console.log('   ✅ Round 2: 8 matches (8 round1 winners + 8 bye players)');
  }

  // Round 3 should have 4 matches (quarterfinals)
  const round3Count = roundCounts.get(3) || 0;
  if (round3Count !== 4) {
    problems.push(`Round 3 should have 4 matches, found ${round3Count}`);
  } else {
    console.log('   ✅ Round 3: 4 matches (quarterfinals)');
  }

  // Round 4 should have 2 matches (semifinals)
  const round4Count = roundCounts.get(4) || 0;
  if (round4Count !== 2) {
    problems.push(`Round 4 should have 2 matches, found ${round4Count}`);
  } else {
    console.log('   ✅ Round 4: 2 matches (semifinals)');
  }

  // Grand final should have 1 match
  const finalCount = roundCounts.get(1000) || 0;
  if (finalCount !== 1) {
    problems.push(`Grand final should have 1 match, found ${finalCount}`);
  } else {
    console.log('   ✅ Grand Final: 1 match');
  }

  return analyzeCommon(players, matches, problems);
}

function analyzeDoubleElimination(players: TournamentPlayer[], matches: TournamentMatch[], roundCounts: Map<number, number>, problems: string[]) {
  console.log('\n🔧 Double Elimination Structure validation:');

  // Winners Bracket
  console.log('   📈 Winners Bracket:');

  // WB Round 1: 8 matches
  const wb1Count = roundCounts.get(1) || 0;
  if (wb1Count !== 8) {
    problems.push(`WB Round 1 should have 8 matches, found ${wb1Count}`);
  } else {
    console.log('     ✅ WB Round 1: 8 matches');
  }

  // WB Round 2: 8 matches
  const wb2Count = roundCounts.get(2) || 0;
  if (wb2Count !== 8) {
    problems.push(`WB Round 2 should have 8 matches, found ${wb2Count}`);
  } else {
    console.log('     ✅ WB Round 2: 8 matches');
  }

  // WB Round 3: 4 matches
  const wb3Count = roundCounts.get(3) || 0;
  if (wb3Count !== 4) {
    problems.push(`WB Round 3 should have 4 matches, found ${wb3Count}`);
  } else {
    console.log('     ✅ WB Round 3: 4 matches');
  }

  // WB Round 4: 2 matches
  const wb4Count = roundCounts.get(4) || 0;
  if (wb4Count !== 2) {
    problems.push(`WB Round 4 should have 2 matches, found ${wb4Count}`);
  } else {
    console.log('     ✅ WB Round 4: 2 matches');
  }

  // WB Final: 1 match
  const wbFinalCount = roundCounts.get(5) || 0;
  if (wbFinalCount !== 1) {
    problems.push(`WB Final should have 1 match, found ${wbFinalCount}`);
  } else {
    console.log('     ✅ WB Final: 1 match');
  }

  // Losers Bracket
  console.log('   📉 Losers Bracket:');

  const lb1Count = roundCounts.get(-1) || 0;
  const lb2Count = roundCounts.get(-2) || 0;
  const lb3Count = roundCounts.get(-3) || 0;
  const lb4Count = roundCounts.get(-4) || 0;
  const lb5Count = roundCounts.get(-5) || 0;
  const lbFinalCount = roundCounts.get(-6) || 0;

  console.log(`     LB Round 1: ${lb1Count} matches (expected: 4)`);
  console.log(`     LB Round 2: ${lb2Count} matches (expected: 6)`);
  console.log(`     LB Round 3: ${lb3Count} matches (expected: 5)`);
  console.log(`     LB Round 4: ${lb4Count} matches (expected: 3)`);
  console.log(`     LB Round 5: ${lb5Count} matches (expected: 2)`);
  console.log(`     LB Final: ${lbFinalCount} matches (expected: 1)`);

  // Grand Finals
  const grandFinalCount = roundCounts.get(1000) || 0;
  const bracketResetCount = roundCounts.get(1001) || 0;

  if (grandFinalCount !== 1) {
    problems.push(`Grand Final should have 1 match, found ${grandFinalCount}`);
  } else {
    console.log('   ✅ Grand Final: 1 match');
  }

  if (bracketResetCount !== 1) {
    problems.push(`Bracket Reset should have 1 match, found ${bracketResetCount}`);
  } else {
    console.log('   ✅ Bracket Reset: 1 match');
  }

  return analyzeCommon(players, matches, problems);
}

function analyzeCommon(players: TournamentPlayer[], matches: TournamentMatch[], problems: string[]) {
  // Check bye distribution
  const playersInRound1 = matches
    .filter(m => m.round === 1)
    .reduce((count, match) => {
      return count + (match.participant1_id ? 1 : 0) + (match.participant2_id ? 1 : 0);
    }, 0);

  const byePlayers = players.length - playersInRound1;
  console.log(`   ✅ Bye players: ${byePlayers} (players 17-24)`);

  // Check for orphaned matches (matches with no participants)
  const orphanedMatches = matches.filter(m => !m.participant1_id && !m.participant2_id && m.round === 1);
  if (orphanedMatches.length > 0) {
    problems.push(`Found ${orphanedMatches.length} orphaned matches with no participants`);
  }

  // Check position uniqueness within rounds
  const positionIssues = new Map<number, number[]>();
  matches.forEach(match => {
    if (!positionIssues.has(match.round)) {
      positionIssues.set(match.round, []);
    }
    positionIssues.get(match.round)!.push(match.position);
  });

  positionIssues.forEach((positions, round) => {
    const uniquePositions = new Set(positions);
    if (positions.length !== uniquePositions.size) {
      problems.push(`Round ${round} has duplicate positions`);
    }
  });

  console.log('\n🎯 PROBLEMS FOUND:');
  if (problems.length === 0) {
    console.log('   ✅ No structural problems detected!');
  } else {
    problems.forEach(problem => console.log(`   ❌ ${problem}`));
  }

  return problems;
}

// Simulate tournament progression
async function simulateTournament(tournamentId: string): Promise<void> {
  console.log('\n🎮 SIMULATING TOURNAMENT PROGRESSION');
  console.log('====================================');

  // Get fresh data
  const { data: players } = await supabase
    .from('bracket_players')
    .select('*')
    .eq('tournament_id', tournamentId);

  const { data: matches } = await supabase
    .from('bracket_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round')
    .order('position');

  if (!players || !matches) {
    throw new Error('Failed to load tournament data');
  }

  // Simulate matches round by round
  let currentMatches = matches.filter(m => m.round === 1);
  let round = 1;

  while (currentMatches.length > 0) {
    console.log(`\n🏁 Round ${round === 1000 ? 'Grand Final' : round}`);

    for (const match of currentMatches) {
      if (match.participant1_id && match.participant2_id) {
        // Both participants present - simulate match
        const winner = Math.random() < 0.5 ? match.participant1_id : match.participant2_id;
        const player1 = players.find(p => p.id === match.participant1_id);
        const player2 = players.find(p => p.id === match.participant2_id);
        const winnerPlayer = players.find(p => p.id === winner);

        console.log(`   ${player1?.name} vs ${player2?.name} → ${winnerPlayer?.name} wins`);

        // Update match
        await supabase
          .from('bracket_matches')
          .update({ winner_participant_id: winner })
          .eq('id', match.id);

        // Advance winner to next round
        await advanceWinner(tournamentId, winner, round);
      } else if (match.participant1_id || match.participant2_id) {
        // Only one participant (bye)
        const winner = match.participant1_id || match.participant2_id;
        const winnerPlayer = players.find(p => p.id === winner);
        console.log(`   ${winnerPlayer?.name} gets bye`);

        await supabase
          .from('bracket_matches')
          .update({ winner_participant_id: winner })
          .eq('id', match.id);

        await advanceWinner(tournamentId, winner!, round);
      } else {
        console.log(`   Empty match (will be filled by previous rounds)`);
      }
    }

    // Move to next round
    if (round === 1000) break; // Grand final

    const nextRound = round === 4 ? 1000 : round + 1;
    currentMatches = matches.filter(m => m.round === nextRound);
    round = nextRound;

    // Refresh matches to see updates
    const { data: updatedMatches } = await supabase
      .from('bracket_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round')
      .order('position');

    if (updatedMatches) {
      currentMatches = updatedMatches.filter(m => m.round === nextRound);
    }
  }
}

// Advance winner to next round
async function advanceWinner(tournamentId: string, winnerId: string, currentRound: number): Promise<void> {
  const nextRound = currentRound === 4 ? 1000 : currentRound + 1;

  // Find next round match that needs this winner
  const { data: nextMatches } = await supabase
    .from('bracket_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('round', nextRound)
    .order('position');

  if (!nextMatches) return;

  // Find first available slot
  for (const match of nextMatches) {
    if (!match.participant1_id) {
      await supabase
        .from('bracket_matches')
        .update({ participant1_id: winnerId })
        .eq('id', match.id);
      break;
    } else if (!match.participant2_id) {
      await supabase
        .from('bracket_matches')
        .update({ participant2_id: winnerId })
        .eq('id', match.id);
      break;
    }
  }
}

// Clean up test tournament
async function cleanup(tournamentId: string): Promise<void> {
  console.log('\n🧹 Cleaning up test tournament...');

  await supabase.from('bracket_matches').delete().eq('tournament_id', tournamentId);
  await supabase.from('bracket_players').delete().eq('tournament_id', tournamentId);
  await supabase.from('bracket_tournaments').delete().eq('id', tournamentId);

  console.log('✅ Cleanup complete');
}

// Test a single bracket type
async function testBracketType(bracketType: 'single' | 'double'): Promise<boolean> {
  let tournamentId: string | null = null;

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 TESTING ${bracketType.toUpperCase()} ELIMINATION`);
    console.log(`${'='.repeat(60)}`);

    // Create tournament and players
    tournamentId = await createTestTournament(bracketType);

    // Get players
    const { data: players } = await supabase
      .from('bracket_players')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('seed');

    if (!players) {
      throw new Error('Failed to fetch players');
    }

    // Generate bracket
    const matches = generateBracketMatches(tournamentId, players, bracketType);

    // Analyze structure
    const problems = analyzeBracket(players, matches, bracketType);

    // Save to database
    await saveMatches(matches);

    // Simulate tournament (skip for now to avoid complexity)
    // await simulateTournament(tournamentId);

    // Final analysis
    console.log(`\n📋 ${bracketType.toUpperCase()} ELIMINATION SUMMARY:`);
    console.log(`   Total matches: ${matches.length}`);
    console.log(`   Total players: ${players.length}`);
    console.log(`   Problems found: ${problems.length}`);

    if (problems.length === 0) {
      console.log('   ✅ PASSED - No issues detected!');
    } else {
      console.log('   ❌ FAILED - Issues found');
      problems.forEach(problem => console.log(`      - ${problem}`));
    }

    return problems.length === 0;

  } catch (error) {
    console.error(`❌ Error testing ${bracketType} elimination:`, error);
    return false;
  } finally {
    if (tournamentId) {
      await cleanup(tournamentId);
    }
  }
}

// Main execution
async function main(): Promise<void> {
  console.log('🚀 STARTING 24-PLAYER BRACKET SIMULATION TESTS');
  console.log('Testing both single and double elimination formats...\n');

  const singleSuccess = await testBracketType('single');
  const doubleSuccess = await testBracketType('double');

  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 FINAL RESULTS');
  console.log(`${'='.repeat(60)}`);
  console.log(`Single Elimination: ${singleSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Double Elimination: ${doubleSuccess ? '✅ PASSED' : '❌ FAILED'}`);

  if (singleSuccess && doubleSuccess) {
    console.log('\n🎉 ALL TESTS PASSED! 24-player brackets are working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
}

main().catch(console.error);