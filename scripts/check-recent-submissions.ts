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

async function checkRecentSubmissions() {
  console.log('🔍 Checking Recent Score Submissions...\n');

  try {
    // Check the most recent score submissions
    const { data: submissions, error: submissionsError } = await supabase
      .from('score_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (submissionsError) {
      console.error('❌ Error fetching score submissions:', submissionsError);
      return;
    }

    console.log(`📋 Found ${submissions?.length || 0} recent score submissions:`);

    if (submissions && submissions.length > 0) {
      submissions.forEach((sub, index) => {
        console.log(`\n${index + 1}. Player: ${sub.player_name}`);
        console.log(`   Score: ${sub.score}`);
        console.log(`   Game ID: ${sub.game_id}`);
        console.log(`   Tournament ID: ${sub.tournament_id}`);
        console.log(`   High Score: ${sub.is_high_score}`);
        console.log(`   Created: ${sub.created_at}`);
      });
    } else {
      console.log('   No submissions found in score_submissions table');
    }

    // Also check regular scores table for comparison
    console.log('\n📊 Recent scores in main scores table:');
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(3);

    if (scoresError) {
      console.error('❌ Error fetching scores:', scoresError);
    } else if (scores && scores.length > 0) {
      scores.forEach((score, index) => {
        console.log(`\n${index + 1}. Player: ${score.player_name}`);
        console.log(`   Score: ${score.score}`);
        console.log(`   Game ID: ${score.game_id}`);
        console.log(`   Tournament ID: ${score.tournament_id}`);
        console.log(`   Updated: ${score.updated_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during check:', error);
  }
}

checkRecentSubmissions().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});