import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testManualInsert() {
  console.log('🧪 Testing Manual Insert to Trigger Real-time...\n');

  try {
    console.log('📝 Manually inserting test record into score_submissions...');

    const testRecord = {
      player_name: 'TEST_MANUAL',
      score: 999999,
      game_id: 'a5b413a3-c9c4-48e2-b394-e611a023bb53', // Using existing game ID
      tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d', // Tournament ID
      is_high_score: true,
      previous_high_score: null
    };

    const { data, error } = await supabase
      .from('score_submissions')
      .insert(testRecord)
      .select();

    if (error) {
      console.error('❌ Error inserting test record:', error);
    } else {
      console.log('✅ Test record inserted successfully:', data);
      console.log('⏳ If real-time is working, listeners should receive this event...');
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

// Wait 2 seconds then insert
setTimeout(() => {
  testManualInsert().then(() => {
    console.log('✨ Manual insert test complete');
    process.exit(0);
  });
}, 2000);

console.log('⏳ Starting in 2 seconds...');