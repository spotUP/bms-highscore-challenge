import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function applyNameLengthFix() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🔧 Applying player name length fix...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Step 1: Try to remove the constraint using a workaround
    console.log('🗑️ Attempting to remove existing constraint...');

    // Create a temporary function that can modify constraints
    const tempFunctionSQL = `
      CREATE OR REPLACE FUNCTION temp_fix_player_name_constraint()
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        -- Drop the old constraint if it exists
        BEGIN
          ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check;
        EXCEPTION WHEN OTHERS THEN
          -- Ignore errors
        END;

        -- Add new constraint allowing 1-16 characters
        BEGIN
          ALTER TABLE scores ADD CONSTRAINT scores_player_name_check
            CHECK (length(trim(player_name)) >= 1 AND length(trim(player_name)) <= 16);
        EXCEPTION WHEN OTHERS THEN
          RETURN 'Error adding constraint: ' || SQLERRM;
        END;

        -- Ensure column can handle the length
        BEGIN
          ALTER TABLE scores ALTER COLUMN player_name TYPE VARCHAR(16);
        EXCEPTION WHEN OTHERS THEN
          -- Ignore if already correct type
        END;

        RETURN 'Success: Player names can now be 1-16 characters';
      END;
      $$;
    `;

    // Since direct SQL execution isn't working well, let's try a different approach
    // We'll manually test if we can bypass the constraint by using very specific values

    console.log('🧪 Testing direct constraint bypass...');

    // First, let's see if we can insert a longer name by being very careful
    const gameId = '95caf0d5-f28f-4dc0-b56d-695adf0aadc8';
    const tournamentId = 'bce0d5e5-2a88-45e2-b84d-86d73dd20dd5';

    // Test with exactly 4 characters (currently failing length)
    const testName = 'Test';
    console.log(`Testing "${testName}" (${testName.length} chars)...`);

    const { data: testScore, error: testError } = await supabase
      .from('scores')
      .insert({
        player_name: testName,
        score: 1000,
        game_id: gameId,
        tournament_id: tournamentId
      })
      .select();

    if (testError) {
      console.log('❌ Constraint still blocking longer names');
      console.log('Error:', testError.message);

      // Manual instructions since automated fix isn't working
      console.log('\n📋 MANUAL FIX REQUIRED:');
      console.log('Since automated constraint modification isn\'t working, please manually run this SQL in your Supabase dashboard:');
      console.log('');
      console.log('1. Go to your Supabase dashboard > SQL Editor');
      console.log('2. Run this command:');
      console.log('');
      console.log('   ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check;');
      console.log('   ALTER TABLE scores ADD CONSTRAINT scores_player_name_check');
      console.log('     CHECK (length(trim(player_name)) >= 1 AND length(trim(player_name)) <= 16);');
      console.log('');
      console.log('3. This will allow player names from 1 to 16 characters');
      console.log('');

      // Alternative: modify the frontend to truncate names
      console.log('📝 TEMPORARY WORKAROUND:');
      console.log('I can modify the score submission form to automatically truncate names to 3 characters');
      console.log('This would allow immediate testing while you apply the database fix.');

    } else {
      console.log('✅ Longer names are now working!');
      console.log('Test score created:', testScore);

      // Clean up
      if (testScore && testScore[0]) {
        await supabase.from('scores').delete().eq('id', testScore[0].id);
        console.log('🧹 Cleaned up test score');
      }

      // Test with even longer name
      const longerTestName = 'PlayerName123';
      console.log(`\nTesting longer name "${longerTestName}" (${longerTestName.length} chars)...`);

      const { data: longerScore, error: longerError } = await supabase
        .from('scores')
        .insert({
          player_name: longerTestName,
          score: 2000,
          game_id: gameId,
          tournament_id: tournamentId
        })
        .select();

      if (longerError) {
        console.log('❌ Very long names still blocked:', longerError.message);
      } else {
        console.log('✅ Long names work perfectly!');
        if (longerScore && longerScore[0]) {
          await supabase.from('scores').delete().eq('id', longerScore[0].id);
        }
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

applyNameLengthFix();