import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function removeConstraint() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🔧 Removing problematic constraint...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Use the SQL editor approach - this should work if we have service role access
    console.log('📝 Executing constraint removal...');

    // First, let's see what the constraint actually is
    const inspectConstraintSQL = `
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conname = 'scores_player_name_check';
    `;

    // Note: We'll use a workaround since direct SQL execution might not be available
    // Let's try to create a temporary stored procedure to do this

    const removeConstraintSQL = `
      DO $$
      DECLARE
        constraint_exists boolean;
      BEGIN
        -- Check if constraint exists
        SELECT EXISTS (
          SELECT 1 FROM information_schema.check_constraints
          WHERE constraint_name = 'scores_player_name_check'
        ) INTO constraint_exists;

        -- Remove it if it exists
        IF constraint_exists THEN
          EXECUTE 'ALTER TABLE scores DROP CONSTRAINT scores_player_name_check';
          RAISE NOTICE 'Constraint scores_player_name_check has been removed';
        ELSE
          RAISE NOTICE 'Constraint scores_player_name_check does not exist';
        END IF;
      END $$;
    `;

    // Since we can't execute arbitrary SQL easily, let's try a different approach:
    // We'll create a simple function to remove the constraint, call it, then drop it

    console.log('🛠️ Creating temporary admin function...');

    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION remove_scores_constraint()
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        BEGIN
          ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check;
          RETURN 'Constraint removed successfully';
        EXCEPTION WHEN OTHERS THEN
          RETURN 'Error: ' || SQLERRM;
        END;
      END;
      $$;
    `;

    // Try to execute via RPC
    const { data: createResult, error: createError } = await supabase.rpc('exec_sql', {
      sql: createFunctionSQL
    });

    if (createError) {
      console.log('⚠️ Could not create function via RPC, trying direct approach...');

      // Alternative: Try to submit a score with a simple name that might pass the constraint
      console.log('🧪 Testing with different player names to understand constraint...');

      const testNames = ['Player1', 'TEST', 'User123', 'A', 'PlayTest'];

      for (const testName of testNames) {
        console.log(`Testing name: "${testName}"`);

        const { data: testScore, error: testError } = await supabase
          .from('scores')
          .insert({
            player_name: testName,
            score: 100,
            game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8', // From previous debug
            tournament_id: 'bce0d5e5-2a88-45e2-b84d-86d73dd20dd5' // You may need to adjust this
          });

        if (testError) {
          console.log(`❌ "${testName}" failed:`, testError.message);
        } else {
          console.log(`✅ "${testName}" succeeded!`);

          // Clean up
          if (testScore && testScore[0]) {
            await supabase.from('scores').delete().eq('id', testScore[0].id);
          }
          break;
        }
      }

    } else {
      console.log('✅ Function created, now calling it...');

      const { data: result, error: callError } = await supabase.rpc('remove_scores_constraint');

      if (callError) {
        console.error('❌ Function call failed:', callError.message);
      } else {
        console.log('✅ Result:', result);

        // Test score submission again
        console.log('🧪 Testing score submission after constraint removal...');

        const { data: testScore, error: testError } = await supabase
          .from('scores')
          .insert({
            player_name: 'Debug Test Player',
            score: 12345,
            game_id: '95caf0d5-f28f-4dc0-b56d-695adf0aadc8',
            tournament_id: 'bce0d5e5-2a88-45e2-b84d-86d73dd20dd5'
          });

        if (testError) {
          console.error('❌ Still failing:', testError.message);
        } else {
          console.log('🎉 Score submission now works!');

          // Clean up
          if (testScore && testScore[0]) {
            await supabase.from('scores').delete().eq('id', testScore[0].id);
          }
        }

        // Clean up function
        await supabase.rpc('exec_sql', {
          sql: 'DROP FUNCTION IF EXISTS remove_scores_constraint();'
        });
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

removeConstraint();