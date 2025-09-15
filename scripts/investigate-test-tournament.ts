import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateTestTournament() {
  console.log('=== Investigating Test Double Elimination Tournament ===\n');

  try {
    // Get all tournaments to compare
    const { data: allTournaments } = await supabase
      .from('bracket_tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('All tournaments:');
    allTournaments?.forEach((tournament, idx) => {
      console.log(`${idx + 1}. ID: ${tournament.id}`);
      console.log(`   Name: ${tournament.name}`);
      console.log(`   Status: ${tournament.status}`);
      console.log(`   Created by: ${tournament.created_by}`);
      console.log(`   Public: ${tournament.is_public}`);
      console.log(`   Searchable: ${tournament.is_searchable}`);
      console.log(`   Bracket type: ${tournament.bracket_type}`);
      console.log(`   Created: ${tournament.created_at}`);
      console.log('');
    });

    // Find the problematic "Test Double Elimination" tournament
    const testTournament = allTournaments?.find(t => t.name === 'Test Double Elimination');
    if (!testTournament) {
      console.log('❌ Test Double Elimination tournament not found');
      return;
    }

    console.log('=== Test Double Elimination Details ===');
    console.log('Tournament details:', JSON.stringify(testTournament, null, 2));

    // Check its players
    const { data: players } = await supabase
      .from('bracket_players')
      .select('*')
      .eq('tournament_id', testTournament.id);

    console.log(`\nPlayers (${players?.length || 0}):`);
    players?.forEach(p => {
      console.log(`  ID: ${p.id}, Name: "${p.name}", User ID: ${p.user_id}`);
    });

    // Check its matches
    const { data: matches } = await supabase
      .from('bracket_matches')
      .select('*')
      .eq('tournament_id', testTournament.id)
      .limit(10);

    console.log(`\nMatches (showing first 10 of ${matches?.length || 0}):`);
    matches?.forEach(m => {
      console.log(`  Round ${m.round}, Position ${m.position}: P1=${m.participant1_id?.slice(0,8)}... P2=${m.participant2_id?.slice(0,8)}... Winner=${m.winner_participant_id?.slice(0,8) || 'None'}...`);
    });

    // Test deletion capability
    console.log('\n=== Testing Deletion Access ===');
    try {
      // Try to delete a match first (safer test)
      const { error: matchDeleteError } = await supabase
        .from('bracket_matches')
        .delete()
        .eq('tournament_id', testTournament.id)
        .eq('round', 999999); // Non-existent round, safe test

      if (matchDeleteError) {
        console.log('❌ Match deletion access denied:', matchDeleteError.message);
      } else {
        console.log('✅ Match deletion access granted');
      }

      // Test tournament update (safer than delete)
      const { error: updateError } = await supabase
        .from('bracket_tournaments')
        .update({ status: testTournament.status }) // No-op update
        .eq('id', testTournament.id);

      if (updateError) {
        console.log('❌ Tournament update access denied:', updateError.message);
      } else {
        console.log('✅ Tournament update access granted');
      }

    } catch (error) {
      console.log('❌ Permission test failed:', error);
    }

    // Compare with working tournament
    const workingTournament = allTournaments?.find(t => t.name !== 'Test Double Elimination' && t.bracket_type === 'double');
    if (workingTournament) {
      console.log('\n=== Comparison with Working Tournament ===');
      console.log('Working tournament:', workingTournament.name);
      console.log('Key differences:');

      const keys = ['created_by', 'is_public', 'is_searchable', 'status'];
      keys.forEach(key => {
        const testVal = testTournament[key];
        const workingVal = workingTournament[key];
        if (testVal !== workingVal) {
          console.log(`  ${key}: Test="${testVal}" vs Working="${workingVal}"`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

investigateTestTournament().catch(console.error);