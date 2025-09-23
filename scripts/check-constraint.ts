import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function checkConstraint() {
  console.log('🔍 Checking bracket_matches table constraints...');

  try {
    console.log('📋 Skipping constraint query (requires direct DB access)');
    console.log('✅ Migration should have been applied already');

    // Try to insert a test row with negative round to see if it works
    console.log('\n🧪 Testing negative round insertion...');

    const { error: insertError } = await supabase
      .from('bracket_matches')
      .insert({
        tournament_id: '00000000-0000-0000-0000-000000000000',
        round: -1,
        match_order: 1,
        player1_id: '00000000-0000-0000-0000-000000000001',
        player2_id: '00000000-0000-0000-0000-000000000002',
        status: 'pending'
      });

    if (insertError) {
      console.log('❌ Cannot insert negative round:', insertError.message);
    } else {
      console.log('✅ Negative round insertion successful - cleaning up...');
      // Clean up the test row
      await supabase
        .from('bracket_matches')
        .delete()
        .eq('tournament_id', '00000000-0000-0000-0000-000000000000');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

checkConstraint().catch(console.error);