import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function reproduceBracketIssue() {
  console.log('🔍 Reproducing bracket generation issue...');

  const tournamentId = '5f71a7cb-63bc-4cf8-9d6d-ae364fe057f0';

  console.log(`\n1️⃣ Clearing existing data for tournament: ${tournamentId}`);

  // Clear existing matches
  const { error: clearMatchesError } = await supabase
    .from('bracket_matches')
    .delete()
    .eq('tournament_id', tournamentId);

  if (clearMatchesError) {
    console.error('❌ Error clearing matches:', clearMatchesError);
    return;
  }

  // Clear existing players
  const { error: clearPlayersError } = await supabase
    .from('bracket_players')
    .delete()
    .eq('tournament_id', tournamentId);

  if (clearPlayersError) {
    console.error('❌ Error clearing players:', clearPlayersError);
    return;
  }

  console.log('✅ Cleared existing data');

  console.log('\n2️⃣ Adding test players...');

  const testPlayerNames = ['Player1', 'Player2', 'Player3', 'Player4'];

  const playerRows = testPlayerNames.map(name => ({
    tournament_id: tournamentId,
    name
  }));

  const { data: addedPlayers, error: addPlayersError } = await supabase
    .from('bracket_players')
    .insert(playerRows)
    .select('*');

  if (addPlayersError) {
    console.error('❌ Error adding players:', addPlayersError);
    return;
  }

  console.log('✅ Added players:', addedPlayers.map(p => `${p.id}: ${p.name}`));

  console.log('\n3️⃣ Verifying players were added...');

  const { data: verifyPlayers, error: verifyError } = await supabase
    .from('bracket_players')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (verifyError) {
    console.error('❌ Error verifying players:', verifyError);
    return;
  }

  console.log(`✅ Found ${verifyPlayers.length} players in database:`);
  verifyPlayers.forEach(p => {
    console.log(`  - ID: ${p.id}, Name: ${p.name}, User: ${p.user_id}`);
  });

  console.log('\n4️⃣ Attempting to create a simple bracket match...');

  if (verifyPlayers.length >= 2) {
    const testMatch = {
      tournament_id: tournamentId,
      round: 1,
      position: 1,
      participant1_id: verifyPlayers[0].id,
      participant2_id: verifyPlayers[1].id,
      winner_participant_id: null
    };

    console.log('Test match data:', testMatch);

    const { data: createdMatch, error: matchError } = await supabase
      .from('bracket_matches')
      .insert(testMatch)
      .select('*');

    if (matchError) {
      console.error('❌ Error creating test match:', matchError);
      console.log('This is the same error we saw in the original issue!');
    } else {
      console.log('✅ Successfully created test match:', createdMatch);
    }
  }

  console.log('\n5️⃣ Checking tournament status...');

  const { data: tournament, error: tournamentError } = await supabase
    .from('bracket_tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError) {
    console.error('❌ Error fetching tournament:', tournamentError);
  } else {
    console.log('Tournament details:', {
      name: tournament.name,
      status: tournament.status,
      bracket_type: tournament.bracket_type,
      created_by: tournament.created_by
    });
  }
}

reproduceBracketIssue().catch(console.error);