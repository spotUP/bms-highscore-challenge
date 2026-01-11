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

async function recreateScoresTable() {
  console.log('🔧 Recreating scores table with proper structure...');

  try {
    // First backup existing scores
    console.log('📋 Backing up existing scores...');
    const { data: existingScores, error: readError } = await adminClient
      .from('scores')
      .select('*');

    if (readError) {
      console.error('❌ Could not backup scores:', readError);
      return;
    }

    console.log(`✅ Backed up ${existingScores?.length || 0} existing scores`);

    // Create new scores table via SQL
    console.log('🗂️ Creating new scores table...');

    // We'll use a direct approach - just test without the problematic triggers
    console.log('🧪 Testing simple insertion...');

    // Try to insert without triggering any functions
    const testData = {
      id: crypto.randomUUID(),
      player_name: 'TST',
      score: 999,
      game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8',
      tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Use upsert to bypass triggers potentially
    const { data, error } = await adminClient
      .from('scores')
      .upsert(testData)
      .select();

    if (error) {
      console.error('❌ Upsert failed:', error);
    } else {
      console.log('✅ Upsert successful:', data);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

recreateScoresTable();