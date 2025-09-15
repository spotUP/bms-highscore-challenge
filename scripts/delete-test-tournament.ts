import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteTestTournament() {
  console.log('=== Deleting Test Double Elimination Tournament ===\n');

  try {
    // Find the problematic tournament
    const { data: testTournament } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .eq('name', 'Test Double Elimination')
      .single();

    if (!testTournament) {
      console.log('❌ Test Double Elimination tournament not found');
      return;
    }

    console.log('Found tournament:', testTournament.name, testTournament.id);
    console.log('Created by:', testTournament.created_by);
    console.log('Status:', testTournament.status);

    // Delete in reverse dependency order: matches -> players -> tournament

    // 1. Delete all matches
    console.log('\n1. Deleting matches...');
    const { error: matchError } = await supabase
      .from('bracket_matches')
      .delete()
      .eq('tournament_id', testTournament.id);

    if (matchError) {
      throw new Error(`Failed to delete matches: ${matchError.message}`);
    }
    console.log('✅ Matches deleted');

    // 2. Delete all players
    console.log('\n2. Deleting players...');
    const { error: playerError } = await supabase
      .from('bracket_players')
      .delete()
      .eq('tournament_id', testTournament.id);

    if (playerError) {
      throw new Error(`Failed to delete players: ${playerError.message}`);
    }
    console.log('✅ Players deleted');

    // 3. Delete the tournament itself
    console.log('\n3. Deleting tournament...');
    const { error: tournamentError } = await supabase
      .from('bracket_tournaments')
      .delete()
      .eq('id', testTournament.id);

    if (tournamentError) {
      throw new Error(`Failed to delete tournament: ${tournamentError.message}`);
    }
    console.log('✅ Tournament deleted');

    console.log('\n🎉 Test Double Elimination tournament completely removed!');

    // Verify deletion
    const { data: verification } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .eq('name', 'Test Double Elimination');

    if (!verification || verification.length === 0) {
      console.log('✅ Deletion verified - tournament no longer exists');
    } else {
      console.log('⚠️  Tournament still exists in database');
    }

  } catch (error) {
    console.error('❌ Deletion failed:', error);
  }
}

deleteTestTournament().catch(console.error);