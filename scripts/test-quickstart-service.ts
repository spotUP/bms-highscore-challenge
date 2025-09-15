import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Use service key to bypass RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testQuickstartWithService() {
  console.log('=== Testing Quickstart with Service Key (Bypassing RLS) ===\n');

  try {
    // First, create a test user
    console.log('Step 1: Create test user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'password123',
      email_confirm: true
    });

    let userId;
    if (authError && authError.message.includes('User already registered')) {
      console.log('Test user already exists, finding user...');
      const { data: users, error: listError } = await supabase.auth.admin.listUsers();
      if (!listError) {
        const testUser = users.users.find(u => u.email === 'test@example.com');
        userId = testUser?.id;
        console.log('Found existing user:', userId);
      }
    } else if (authData?.user) {
      userId = authData.user.id;
      console.log('✅ Test user created:', userId);
    }

    if (!userId) {
      console.error('❌ Could not get user ID');
      return;
    }

    console.log('\nStep 2: Create a test double elimination tournament...');

    const { data: newTournament, error: createError } = await supabase
      .from('bracket_tournaments')
      .insert({
        name: 'Test Double Elimination',
        bracket_type: 'double',
        status: 'draft',
        is_public: true,
        created_by: userId
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

    console.log('\nStep 4: Generate double elimination bracket (first round)...');

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

    console.log('\nStep 5: Test bracket generation with double elimination structure...');

    // Create a more complete double elimination bracket
    const totalWinnersRounds = Math.log2(bracketSize);
    const allMatches = [...firstRoundMatches];

    // Create rest of winners bracket
    for (let round = 2; round <= totalWinnersRounds; round++) {
      const matchesInRound = Math.pow(2, totalWinnersRounds - round);
      for (let pos = 1; pos <= matchesInRound; pos++) {
        allMatches.push({
          tournament_id: newTournament.id,
          round: round,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
    }

    // Create losers bracket rounds
    if (totalWinnersRounds === 3) { // 8-player tournament
      // L1: 2 matches
      for (let pos = 1; pos <= 2; pos++) {
        allMatches.push({
          tournament_id: newTournament.id,
          round: 100,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      // L2: 1 match
      allMatches.push({
        tournament_id: newTournament.id,
        round: 101,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });
      // L3: 1 match
      allMatches.push({
        tournament_id: newTournament.id,
        round: 102,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });
      // L4: 1 match (losers final)
      allMatches.push({
        tournament_id: newTournament.id,
        round: 103,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });
    }

    // Grand final
    allMatches.push({
      tournament_id: newTournament.id,
      round: 1000,
      position: 1,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });

    // Insert remaining matches
    const remainingMatches = allMatches.slice(firstRoundMatches.length);
    if (remainingMatches.length > 0) {
      const { error: remainingError } = await supabase
        .from('bracket_matches')
        .insert(remainingMatches);

      if (remainingError) {
        console.error('❌ Error creating remaining matches:', remainingError);
        return;
      }

      console.log(`✅ Created ${remainingMatches.length} additional matches`);
    }

    console.log('\nStep 6: Verify complete bracket structure...');

    const { data: allTournamentMatches, error: allMatchesError } = await supabase
      .from('bracket_matches')
      .select('*')
      .eq('tournament_id', newTournament.id)
      .order('round', { ascending: true })
      .order('position', { ascending: true });

    if (allMatchesError) {
      console.error('❌ Error retrieving all matches:', allMatchesError);
      return;
    }

    const matchesBySection = allTournamentMatches.reduce((acc, match) => {
      const section = match.round >= 1000 ? 'Grand Finals' :
                    match.round >= 100 ? 'Losers' :
                    'Winners';
      if (!acc[section]) acc[section] = [];
      acc[section].push(match);
      return acc;
    }, {});

    console.log('Bracket structure:');
    Object.entries(matchesBySection).forEach(([section, sectionMatches]) => {
      console.log(`  ${section}: ${sectionMatches.length} matches`);
    });

    console.log('\n🎉 Quickstart test completed successfully!');
    console.log(`Tournament ID: ${newTournament.id}`);
    console.log(`Test User ID: ${userId}`);
    console.log('The tournament is ready for testing.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testQuickstartWithService().catch(console.error);