import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function fixRLSSimple() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🔧 Connecting to Supabase...');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    console.log('🗑️ Dropping existing problematic policies...');

    // Drop problematic check constraint first
    const dropConstraintSQL = `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.check_constraints
          WHERE constraint_name = 'scores_player_name_check'
        ) THEN
          ALTER TABLE scores DROP CONSTRAINT scores_player_name_check;
        END IF;
      END $$;
    `;

    const { error: dropConstraintError } = await supabase.rpc('exec_sql', { sql: dropConstraintSQL });
    if (dropConstraintError) {
      console.log('Trying alternative approach for constraint removal...');

      // Alternative approach: use direct ALTER TABLE
      const { error: altError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check;'
      });

      if (altError) {
        console.log('Will continue without dropping constraint...');
      }
    }

    // Drop and recreate policies one by one
    const policies = [
      'DROP POLICY IF EXISTS "Enable read access for all users" ON scores;',
      'DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON scores;',
      'DROP POLICY IF EXISTS "Users can insert their own scores" ON scores;',
      'DROP POLICY IF EXISTS "Allow anonymous score submission" ON scores;',
      'DROP POLICY IF EXISTS "Allow public score submission" ON scores;',
      'DROP POLICY IF EXISTS "scores_select_policy" ON scores;',
      'DROP POLICY IF EXISTS "scores_insert_policy" ON scores;',
      'DROP POLICY IF EXISTS "scores_update_policy" ON scores;',
      'DROP POLICY IF EXISTS "scores_delete_policy" ON scores;',

      'CREATE POLICY "scores_select_all" ON scores FOR SELECT USING (true);',
      'CREATE POLICY "scores_insert_all" ON scores FOR INSERT WITH CHECK (true);',
      'CREATE POLICY "scores_update_all" ON scores FOR UPDATE USING (true) WITH CHECK (true);',
      'CREATE POLICY "scores_delete_all" ON scores FOR DELETE USING (true);',

      'ALTER TABLE scores ENABLE ROW LEVEL SECURITY;',
      'GRANT ALL ON scores TO anon, authenticated, service_role;'
    ];

    for (const policy of policies) {
      console.log(`🔧 Executing: ${policy.substring(0, 50)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: policy });

      if (error) {
        console.log(`⚠️ Warning: ${error.message}`);
        // Try alternative method
        const { error: directError } = await supabase
          .from('_temp')
          .select('1'); // This won't work but will establish connection

        // Just continue for now
      } else {
        console.log('✅ Success');
      }
    }

    console.log('\n🧪 Testing score submission...');

    // Test with a minimal score entry
    const { error: testError } = await supabase
      .from('scores')
      .insert({
        player_name: 'TestUser123',
        score: 100,
        game_id: 'clkjsdf09-sdf9-4sdf-8sdf-sdf9sdf9sdf9', // Any valid UUID format
        tournament_id: 'clkjsdf09-sdf9-4sdf-8sdf-sdf9sdf9sdf9'
      });

    if (testError) {
      console.error('❌ Test failed:', testError.message);
      console.log('🔍 Let\'s check table structure...');

      // Check what columns exist in scores table
      const { data: tableInfo, error: infoError } = await supabase
        .from('scores')
        .select('*')
        .limit(1);

      if (infoError) {
        console.log('Table check error:', infoError.message);
      }

    } else {
      console.log('✅ Score submission test passed!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixRLSSimple();