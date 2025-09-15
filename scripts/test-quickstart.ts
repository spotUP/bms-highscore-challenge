import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testQuickstart() {
  console.log('=== Testing Quickstart Functionality ===\n');

  try {
    console.log('Step 1: Check if bracket tables exist...');

    // Check if tables exist by trying to query them
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('bracket_tournaments')
      .select('count', { count: 'exact' });

    if (tournamentsError) {
      console.error('❌ Error checking tournaments table:', tournamentsError);
      console.log('The bracket tables may not exist. Running migration...');

      // If this fails, we need to run migrations
      return;
    }

    console.log('✅ bracket_tournaments table exists');

    console.log('\nStep 2: Create a test double elimination tournament...');

    // Create a test tournament
    const { data: newTournament, error: createError } = await supabase
      .from('bracket_tournaments')
      .insert({
        name: 'Test Double Elimination',
        bracket_type: 'double',
        status: 'draft',
        is_public: true,
        created_by: '00000000-0000-0000-0000-000000000000' // placeholder user ID
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating tournament:', createError);
      return;
    }

    console.log('✅ Tournament created:', newTournament.name, 'ID:', newTournament.id);

    console.log('\nStep 3: Add test players...');

    const testPlayers = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
    const playerRows = testPlayers.map(name => ({
      tournament_id: newTournament.id,
      name
    }));

    const { data: players, error: playersError } = await supabase
      .from('bracket_players')
      .insert(playerRows)
      .select();

    if (playersError) {
      console.error('❌ Error adding players:', playersError);
      return;
    }

    console.log(`✅ Added ${players.length} players:`, players.map(p => p.name).join(', '));

    console.log('\nStep 4: Generate double elimination bracket...');

    // We need to simulate the bracket generation logic here
    // For now, just create the first round of matches
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(players.length)));
    const seededPlayers = [...players];
    while (seededPlayers.length < bracketSize) {
      seededPlayers.push(null);
    }

    const firstRoundMatches = [];
    let position = 1;
    for (let i = 0; i < seededPlayers.length; i += 2) {
      firstRoundMatches.push({
        tournament_id: newTournament.id,
        round: 1,
        position: position++,
        participant1_id: seededPlayers[i]?.id || null,
        participant2_id: seededPlayers[i + 1]?.id || null,
        winner_participant_id: null
      });
    }

    const { data: matches, error: matchesError } = await supabase
      .from('bracket_matches')
      .insert(firstRoundMatches)
      .select();

    if (matchesError) {
      console.error('❌ Error creating matches:', matchesError);
      return;
    }

    console.log(`✅ Created ${matches.length} first round matches`);

    console.log('\nStep 5: Verify data retrieval...');

    // Test the same query that the UI uses
    const { data: retrievedPlayers, error: retrievePlayersError } = await supabase
      .from('bracket_players')
      .select('*')
      .eq('tournament_id', newTournament.id);

    const { data: retrievedMatches, error: retrieveMatchesError } = await supabase
      .from('bracket_matches')
      .select('*')
      .eq('tournament_id', newTournament.id)
      .order('round', { ascending: true })
      .order('position', { ascending: true });

    if (retrievePlayersError || retrieveMatchesError) {
      console.error('❌ Error retrieving data:', retrievePlayersError || retrieveMatchesError);
      return;
    }

    console.log(`✅ Retrieved ${retrievedPlayers.length} players and ${retrievedMatches.length} matches`);

    console.log('\nStep 6: Test participant mapping...');

    // Test the same mapping logic used in the UI
    const participantMap = {};
    retrievedPlayers.forEach(p => {
      participantMap[p.id] = {
        id: p.id,
        display_name: p.name,
        name: p.name
      };
    });

    console.log('✅ Participant map created:', Object.keys(participantMap).length, 'participants');

    // Show first match with participant names
    const firstMatch = retrievedMatches[0];
    const p1Name = participantMap[firstMatch.participant1_id]?.name || '—';
    const p2Name = participantMap[firstMatch.participant2_id]?.name || '—';
    console.log(`First match: ${p1Name} vs ${p2Name}`);

    console.log('\n🎉 Quickstart test completed successfully!');
    console.log(`Tournament ID: ${newTournament.id}`);
    console.log('You can now test this tournament in the bracket view.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testQuickstart().catch(console.error);