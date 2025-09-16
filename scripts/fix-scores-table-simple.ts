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

async function fixScoresTable() {
  console.log('🔧 Fixing scores table constraint...');

  try {
    // First, let's check the current constraint
    console.log('🔍 Checking current constraints...');
    const { data: constraints, error: constraintError } = await adminClient
      .from('information_schema.check_constraints')
      .select('*')
      .eq('constraint_name', 'scores_player_name_check');

    if (constraintError) {
      console.log('Could not check constraints:', constraintError);
    } else {
      console.log('Current constraint:', constraints);
    }

    // Try to test current submission
    console.log('🧪 Testing current score submission...');
    const testGameId = '95caf0d5-f28f-4dc0-b56d-695adf0aadc8'; // From debug output
    const testTournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d'; // From debug output

    const { data, error } = await adminClient
      .from('scores')
      .insert({
        player_name: 'TestUser',
        score: 12345,
        game_id: testGameId,
        tournament_id: testTournamentId
      })
      .select();

    if (error) {
      console.error('❌ Score submission still failing:', error);

      if (error.code === '23514') {
        console.log('💡 The issue is the 3-character constraint. Let me remove it via table alteration...');

        // Try using raw SQL through the query interface
        const dropResult = await adminClient.query('ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check');
        console.log('Drop result:', dropResult);

        const addResult = await adminClient.query('ALTER TABLE scores ADD CONSTRAINT scores_player_name_check CHECK (LENGTH(player_name) <= 16 AND LENGTH(player_name) >= 1)');
        console.log('Add result:', addResult);
      }
    } else {
      console.log('✅ Score submission works! Inserted:', data);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixScoresTable();