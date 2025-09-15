import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkExistingScores() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🔍 Checking existing scores to understand player_name format...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Check existing scores
    const { data: scores, error } = await supabase
      .from('scores')
      .select('player_name, score, game_id')
      .limit(10);

    if (error) {
      console.error('❌ Error fetching scores:', error);
      return;
    }

    console.log('📊 Existing scores:');
    if (scores && scores.length > 0) {
      scores.forEach(score => {
        console.log(`  Player: "${score.player_name}" | Score: ${score.score}`);
      });
    } else {
      console.log('  No existing scores found');
    }

    // Check player_name constraint
    console.log('\n🔍 Checking player_name constraints...');
    const { data: constraints, error: constraintError } = await supabase
      .from('information_schema.check_constraints')
      .select('constraint_name, check_clause')
      .like('constraint_name', '%player_name%');

    if (constraintError) {
      console.log('❌ Could not fetch constraints:', constraintError);
    } else {
      console.log('📋 Player name constraints:', constraints);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkExistingScores();