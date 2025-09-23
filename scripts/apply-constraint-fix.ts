import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function applyConstraintFix() {
  console.log('🔧 Applying bracket round constraint fix directly...');

  try {
    // First, try to drop the old constraint
    console.log('1️⃣ Dropping old constraint...');
    const { error: dropError } = await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_round_check;'
    });

    if (dropError) {
      console.log('⚠️  Drop constraint error (might not exist):', dropError.message);
    } else {
      console.log('✅ Old constraint dropped successfully');
    }

    // Then, add the new constraint
    console.log('2️⃣ Adding new constraint...');
    const { error: addError } = await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE bracket_matches ADD CONSTRAINT bracket_matches_round_check CHECK (round IS NOT NULL);'
    });

    if (addError) {
      console.error('❌ Error adding new constraint:', addError.message);
      return;
    }

    console.log('✅ New constraint added successfully');

    // Test that negative rounds now work
    console.log('3️⃣ Testing negative round insertion...');
    const testTournamentId = '00000000-0000-0000-0000-000000000000';
    const testPlayer1Id = '00000000-0000-0000-0000-000000000001';
    const testPlayer2Id = '00000000-0000-0000-0000-000000000002';

    const { error: insertError } = await supabase
      .from('bracket_matches')
      .insert({
        tournament_id: testTournamentId,
        round: -1,
        player1_id: testPlayer1Id,
        player2_id: testPlayer2Id,
        status: 'pending'
      });

    if (insertError) {
      console.error('❌ Still cannot insert negative round:', insertError.message);
    } else {
      console.log('✅ Negative round insertion successful!');

      // Clean up test data
      await supabase
        .from('bracket_matches')
        .delete()
        .eq('tournament_id', testTournamentId);

      console.log('🧹 Test data cleaned up');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

applyConstraintFix().catch(console.error);