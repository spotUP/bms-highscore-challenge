import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteTest2Tournament() {
  try {
    console.log('🔍 Looking for "Test2" tournament...');

    // Find the Test2 tournament
    const { data: tournaments, error: findError } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .ilike('name', 'Test2');

    if (findError) {
      console.error('❌ Error finding tournament:', findError);
      return;
    }

    if (!tournaments || tournaments.length === 0) {
      console.log('❌ No tournament named "Test2" found');
      return;
    }

    console.log(`📋 Found ${tournaments.length} tournament(s) named "Test2":`);
    tournaments.forEach((t, i) => {
      console.log(`  ${i + 1}. ID: ${t.id}, Name: "${t.name}", Status: ${t.status}, Created: ${t.created_at}`);
    });

    // Delete each Test2 tournament
    for (const tournament of tournaments) {
      console.log(`\n🗑️ Deleting tournament "${tournament.name}" (ID: ${tournament.id})...`);

      // Delete matches first (foreign key constraint)
      const { error: matchesError } = await supabase
        .from('bracket_matches')
        .delete()
        .eq('tournament_id', tournament.id);

      if (matchesError) {
        console.error('❌ Error deleting matches:', matchesError);
        continue;
      }
      console.log('✅ Deleted matches');

      // Delete players
      const { error: playersError } = await supabase
        .from('bracket_players')
        .delete()
        .eq('tournament_id', tournament.id);

      if (playersError) {
        console.error('❌ Error deleting players:', playersError);
        continue;
      }
      console.log('✅ Deleted players');

      // Delete tournament
      const { error: tournamentError } = await supabase
        .from('bracket_tournaments')
        .delete()
        .eq('id', tournament.id);

      if (tournamentError) {
        console.error('❌ Error deleting tournament:', tournamentError);
        continue;
      }
      console.log('✅ Deleted tournament');
    }

    console.log('\n🎉 All "Test2" tournaments have been successfully deleted!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

deleteTest2Tournament();