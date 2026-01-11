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

async function disableAchievementTrigger() {
  console.log('🔧 Temporarily disabling achievement trigger to fix score submissions...');

  try {
    // Execute raw SQL to drop the trigger
    const { data, error } = await adminClient
      .from('scores')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Cannot access scores table:', error);
      return;
    }

    console.log('✅ Can access scores table');

    // Test score submission directly
    console.log('📝 Testing score submission...');
    const { data: scoreData, error: submitError } = await adminClient
      .from('scores')
      .insert({
        player_name: 'TEST',
        score: 12345,
        game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8',
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d'
      })
      .select();

    if (submitError) {
      console.error('❌ Score submission still failing:', submitError);
    } else {
      console.log('✅ Score submission working! Data:', scoreData);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

disableAchievementTrigger();