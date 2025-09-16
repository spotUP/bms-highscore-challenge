import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findCurrentTournament() {
  try {
    console.log('🔍 Finding current tournaments...\n');

    // Get all bracket tournaments
    const { data: tournaments, error: tournamentError } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .order('updated_at', { ascending: false });

    if (tournamentError) {
      console.error('❌ Error fetching tournaments:', tournamentError);
      return;
    }

    if (!tournaments || tournaments.length === 0) {
      console.log('❌ No tournaments found');
      return;
    }

    console.log(`📋 Found ${tournaments.length} tournaments:\n`);

    tournaments.forEach((tournament, i) => {
      console.log(`${i + 1}. "${tournament.name}" (ID: ${tournament.id})`);
      console.log(`   Type: ${tournament.bracket_type}`);
      console.log(`   Status: ${tournament.status}`);
      console.log(`   Created: ${tournament.created_at}`);
      console.log(`   Updated: ${tournament.updated_at}\n`);
    });

    // Look for the most recent tournament that's not completed
    const activeTournament = tournaments.find(t => t.status !== 'completed');
    if (activeTournament) {
      console.log(`🎯 Most recent non-completed tournament: "${activeTournament.name}"`);
      console.log(`   ID: ${activeTournament.id}`);

      // Get match count for this tournament
      const { data: matches, error: matchError } = await supabase
        .from('bracket_matches')
        .select('*')
        .eq('tournament_id', activeTournament.id);

      if (!matchError && matches) {
        console.log(`   Matches: ${matches.length}`);
        const completedMatches = matches.filter(m => m.winner_participant_id).length;
        console.log(`   Completed: ${completedMatches}/${matches.length}`);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

findCurrentTournament();