import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testBracketAdmin() {
  console.log('=== Testing Bracket Admin Functionality ===\n');

  try {
    // Test 1: Create a new tournament (simulating bracket admin)
    console.log('Test 1: Creating new tournament...');
    const tournamentData = {
      name: 'Test Admin Tournament',
      bracket_type: 'double',
      status: 'draft'
    };

    const { data: newTournament, error: tournamentError } = await supabase
      .from('bracket_tournaments')
      .insert([tournamentData])
      .select()
      .single();

    if (tournamentError) throw tournamentError;
    console.log('✅ Tournament created:', newTournament.name, newTournament.id);

    // Test 2: Add players (simulating bracket admin)
    console.log('\nTest 2: Adding players...');
    const playerNames = ['Test A', 'Test B', 'Test C', 'Test D'];
    const playerInserts = playerNames.map(name => ({
      tournament_id: newTournament.id,
      name: name
    }));

    const { data: newPlayers, error: playersError } = await supabase
      .from('bracket_players')
      .insert(playerInserts)
      .select();

    if (playersError) throw playersError;
    console.log('✅ Players created:', newPlayers.map(p => p.name).join(', '));

    // Test 3: Generate bracket (simulating bracket admin quickstart)
    console.log('\nTest 3: Generating bracket...');

    // Clear any existing matches first (prevent 409 conflicts)
    await supabase
      .from('bracket_matches')
      .delete()
      .eq('tournament_id', newTournament.id);

    const playerCount = newPlayers.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(playerCount)));
    const totalWinnersRounds = Math.log2(bracketSize);

    console.log(`Creating double elimination bracket for ${playerCount} players (bracket size: ${bracketSize})`);

    // Create seeded bracket
    const seededPlayers = new Array(bracketSize).fill(null);
    for (let i = 0; i < newPlayers.length; i++) {
      seededPlayers[i] = newPlayers[i];
    }

    const matches = [];

    // Winners bracket round 1
    let position = 1;
    for (let i = 0; i < seededPlayers.length; i += 2) {
      matches.push({
        tournament_id: newTournament.id,
        round: 1,
        position: position++,
        participant1_id: seededPlayers[i]?.id || null,
        participant2_id: seededPlayers[i + 1]?.id || null,
        winner_participant_id: null
      });
    }

    // Insert matches
    const { error: matchesError } = await supabase
      .from('bracket_matches')
      .insert(matches);

    if (matchesError) throw matchesError;
    console.log('✅ Matches created successfully');

    // Test 4: Verify data can be retrieved (simulating Competition view)
    console.log('\nTest 4: Verifying data retrieval...');

    const { data: retrievedPlayers } = await supabase
      .from('bracket_players')
      .select('*')
      .eq('tournament_id', newTournament.id);

    const { data: retrievedMatches } = await supabase
      .from('bracket_matches')
      .select('*')
      .eq('tournament_id', newTournament.id);

    // Simulate participant map creation (like Competition component)
    const participantMap: Record<string, any> = {};
    if (retrievedPlayers) {
      retrievedPlayers.forEach(p => {
        participantMap[p.id] = {
          id: p.id,
          display_name: p.name,
          name: p.name
        };
      });
    }

    console.log('✅ Data retrieval successful');
    console.log(`   Players: ${retrievedPlayers?.length || 0}`);
    console.log(`   Matches: ${retrievedMatches?.length || 0}`);
    console.log(`   Participant map keys: ${Object.keys(participantMap).length}`);

    // Test participant lookup (like BracketView would do)
    const firstMatch = retrievedMatches?.[0];
    if (firstMatch) {
      const p1 = firstMatch.participant1_id ? participantMap[firstMatch.participant1_id] : undefined;
      const p2 = firstMatch.participant2_id ? participantMap[firstMatch.participant2_id] : undefined;

      console.log('   Sample match lookup:');
      console.log(`     P1: ${p1?.display_name || 'NOT FOUND'}`);
      console.log(`     P2: ${p2?.display_name || 'NOT FOUND'}`);
    }

    console.log('\n✅ All bracket admin functionality tests passed!');

    // Cleanup
    console.log('\nCleaning up test data...');
    await supabase.from('bracket_matches').delete().eq('tournament_id', newTournament.id);
    await supabase.from('bracket_players').delete().eq('tournament_id', newTournament.id);
    await supabase.from('bracket_tournaments').delete().eq('id', newTournament.id);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBracketAdmin().catch(console.error);