import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function debugBracketPlayers() {
  console.log('🔍 Debugging bracket players data...');

  // Get the tournament ID from the error message
  const tournamentId = '5f71a7cb-63bc-4cf8-9d6d-ae364fe057f0';

  console.log(`\n📋 Checking tournament: ${tournamentId}`);

  // Check bracket_players table for this tournament
  const { data: bracketPlayers, error: playersError } = await supabase
    .from('bracket_players')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (playersError) {
    console.error('❌ Error fetching bracket players:', playersError);
    return;
  }

  console.log(`\n🎮 Found ${bracketPlayers.length} players in bracket_players table:`);
  bracketPlayers.forEach(player => {
    console.log(`  - ID: ${player.id}, User: ${player.user_id}, Name: ${player.name}`);
  });

  // Check the tournament table
  const { data: tournament, error: tournamentError } = await supabase
    .from('bracket_tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError) {
    console.error('❌ Error fetching tournament:', tournamentError);
    return;
  }

  console.log(`\n🏆 Tournament details:`);
  console.log(`  - Name: ${tournament.name}`);
  console.log(`  - Status: ${tournament.status}`);
  console.log(`  - Type: ${tournament.bracket_type}`);

  // Check if there are any existing bracket matches
  const { data: existingMatches, error: matchesError } = await supabase
    .from('bracket_matches')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (matchesError) {
    console.error('❌ Error fetching existing matches:', matchesError);
    return;
  }

  console.log(`\n⚔️ Found ${existingMatches.length} existing matches:`);
  existingMatches.forEach(match => {
    console.log(`  - Round ${match.round}, Position ${match.position}: ${match.participant1_id} vs ${match.participant2_id}`);
  });

  // Now let's check what IDs the failed log messages were trying to use
  const failedIds = [
    'e77a3f46-4f41-41aa-82b1-a8d1141860b1',
    'e2383623-3eaf-4776-870f-88604eea5307',
    '445f9a9c-57fa-4bbc-80b9-8c95cde5985e',
    'a146f7e2-c2ec-414b-aeda-f338f175aeb5'
  ];

  console.log(`\n🚨 Checking failed IDs from error log:`);
  for (const id of failedIds) {
    const playerMatch = bracketPlayers.find(p => p.id === id);
    if (playerMatch) {
      console.log(`  ✅ ${id} found in bracket_players as ${playerMatch.name}`);
    } else {
      console.log(`  ❌ ${id} NOT found in bracket_players`);

      // Check if this ID exists in users table
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', id)
        .single();

      if (user) {
        console.log(`    -> Found in users table as ${user.name}`);
      } else {
        console.log(`    -> Not found in users table either`);
      }
    }
  }
}

debugBracketPlayers().catch(console.error);