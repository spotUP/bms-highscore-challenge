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

async function addUserIdToScores() {
  console.log('🔧 Adding user_id field to scores table...');

  try {
    // Add user_id column to scores table
    console.log('Adding user_id column...');
    const { data, error } = await adminClient
      .from('scores')
      .select('user_id')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      console.log('user_id column does not exist, adding it...');

      // We need to use raw SQL to add the column
      // Since we can't easily run DDL, let's try inserting with user_id
      console.log('Testing insertion with user_id...');

      const testGameId = '95caf0d5-f28f-4dc0-b56d-695adf0aadc8';
      const testTournamentId = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

      const { data: insertData, error: insertError } = await adminClient
        .from('scores')
        .insert({
          player_name: 'TST',
          score: 9999,
          game_id: testGameId,
          tournament_id: testTournamentId,
          user_id: '0f0672de-6b1a-49e1-8857-41fef18dc6f8' // Add a user_id
        })
        .select();

      if (insertError) {
        console.error('❌ Insert still failing:', insertError);
      } else {
        console.log('✅ Success with user_id! Inserted:', insertData);
      }
    } else {
      console.log('user_id column already exists');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

addUserIdToScores();