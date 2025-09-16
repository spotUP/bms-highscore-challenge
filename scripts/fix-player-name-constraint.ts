import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixPlayerNameConstraint() {
  console.log('🔧 Fixing player name constraint...');

  try {
    // Drop the old constraint
    console.log('Dropping old constraint...');
    const { error: dropError } = await adminClient.rpc('execute_sql', {
      query: 'ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check;'
    });

    if (dropError) {
      console.log('Note: Could not drop constraint (might not exist):', dropError.message);
    }

    // Add a more reasonable constraint (16 characters max, 1 minimum)
    console.log('Adding new constraint...');
    const { error: addError } = await adminClient.rpc('execute_sql', {
      query: 'ALTER TABLE scores ADD CONSTRAINT scores_player_name_check CHECK (LENGTH(player_name) <= 16 AND LENGTH(player_name) >= 1);'
    });

    if (addError) {
      console.error('❌ Error adding new constraint:', addError);
      return;
    }

    console.log('✅ Player name constraint fixed! Now allows 1-16 characters.');

    // Test the fix
    console.log('🧪 Testing score submission...');
    const { error: testError } = await adminClient
      .from('scores')
      .insert({
        player_name: 'Test Player',
        score: 12345,
        game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8', // Use existing game ID
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d' // Use existing tournament ID
      });

    if (testError) {
      console.error('❌ Test submission failed:', testError);
    } else {
      console.log('✅ Test score submission successful!');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixPlayerNameConstraint();