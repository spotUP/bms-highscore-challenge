import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestTournament() {
  try {
    console.log('🏆 Creating Test Tournament for debugging...\n');

    // Create tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('bracket_tournaments')
      .insert({
        name: 'Debug Tournament',
        bracket_type: 'double',
        status: 'setup',
        created_by: null
      })
      .select()
      .single();

    if (tournamentError) {
      console.error('❌ Error creating tournament:', tournamentError);
      return;
    }

    console.log(`✅ Created tournament "${tournament.name}" (ID: ${tournament.id})`);

    // Create 8 players
    const players = [];
    for (let i = 1; i <= 8; i++) {
      const { data: player, error: playerError } = await supabase
        .from('bracket_players')
        .insert({
          tournament_id: tournament.id,
          name: `Player ${i}`,
          user_id: `test-user-${i}`
        })
        .select()
        .single();

      if (playerError) {
        console.error(`❌ Error creating player ${i}:`, playerError);
        return;
      }

      players.push(player);
      console.log(`✅ Created ${player.name}`);
    }

    console.log(`\n🎯 Tournament ID: ${tournament.id}`);
    console.log('🎮 Ready to generate bracket! Use the UI to generate the bracket and play through it.');
    console.log('🔍 Then run debug-tournament-matches.ts to analyze the structure.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createTestTournament();