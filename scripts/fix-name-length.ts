import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function fixNameLength() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🔧 Fixing player name length constraint...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Create a function to handle the constraint modification
    console.log('📝 Creating constraint modification function...');

    const modifyConstraintFunction = `
      CREATE OR REPLACE FUNCTION fix_player_name_constraint()
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        constraint_exists boolean;
        constraint_def text;
      BEGIN
        -- Check if the constraint exists and get its definition
        SELECT EXISTS (
          SELECT 1 FROM information_schema.check_constraints
          WHERE constraint_name = 'scores_player_name_check'
        ) INTO constraint_exists;

        IF constraint_exists THEN
          -- Get current constraint definition
          SELECT pg_get_constraintdef(oid) INTO constraint_def
          FROM pg_constraint
          WHERE conname = 'scores_player_name_check';

          -- Drop the old constraint
          ALTER TABLE scores DROP CONSTRAINT scores_player_name_check;

          -- Add new constraint allowing up to 16 characters
          ALTER TABLE scores ADD CONSTRAINT scores_player_name_check
            CHECK (length(player_name) <= 16 AND length(player_name) >= 1);

          RETURN 'Constraint updated: Old constraint was ' || COALESCE(constraint_def, 'unknown') ||
                 '. New constraint allows 1-16 characters.';
        ELSE
          -- Add the constraint if it doesn't exist
          ALTER TABLE scores ADD CONSTRAINT scores_player_name_check
            CHECK (length(player_name) <= 16 AND length(player_name) >= 1);

          RETURN 'New constraint added: player_name must be 1-16 characters.';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RETURN 'Error: ' || SQLERRM;
      END;
      $$;
    `;

    // Try to execute the function creation via raw SQL
    console.log('🛠️ Attempting to create the function...');

    // Since we can't execute raw SQL easily, let's try a different approach
    // We'll use the existing migration system by creating a new migration
    console.log('📋 Creating migration file...');

    const migrationContent = `-- Fix player name length constraint to allow up to 16 characters

-- Drop the existing restrictive constraint
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check;

-- Add new constraint allowing 1-16 characters
ALTER TABLE scores ADD CONSTRAINT scores_player_name_check
  CHECK (length(player_name) <= 16 AND length(player_name) >= 1 AND trim(player_name) != '');

-- Also ensure the column can handle this length
ALTER TABLE scores ALTER COLUMN player_name TYPE VARCHAR(16);`;

    // Write the migration file
    const fs = require('fs');
    const path = require('path');

    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250915000001_fix_player_name_length.sql');
    fs.writeFileSync(migrationPath, migrationContent);

    console.log('✅ Migration file created:', migrationPath);

    // Now let's test the current state and provide a workaround
    console.log('🧪 Testing current constraint with longer names...');

    const gameId = '95caf0d5-f28f-4dc0-b56d-695adf0aadc8';
    const tournamentId = 'bce0d5e5-2a88-45e2-b84d-86d73dd20dd5';

    const testNames = [
      'Test4',           // 5 chars - should fail with current constraint
      'PlayerName',      // 10 chars - should fail
      'TestPlayer16Ch',  // 15 chars - target length
      'MaxLen16Chars12', // 16 chars - maximum target
    ];

    for (const testName of testNames) {
      console.log(`Testing: "${testName}" (${testName.length} chars)`);

      const { data: testScore, error: testError } = await supabase
        .from('scores')
        .insert({
          player_name: testName,
          score: Math.floor(Math.random() * 1000),
          game_id: gameId,
          tournament_id: tournamentId
        })
        .select();

      if (testError) {
        console.log(`  ❌ Failed: ${testError.message}`);
      } else {
        console.log(`  ✅ Success!`);

        // Clean up
        if (testScore && testScore[0]) {
          await supabase.from('scores').delete().eq('id', testScore[0].id);
        }
      }
    }

    console.log('\n📝 Instructions to apply the fix:');
    console.log('1. Run: npx supabase db push');
    console.log('2. Or manually execute the SQL in your Supabase dashboard:');
    console.log('   ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_name_check;');
    console.log('   ALTER TABLE scores ADD CONSTRAINT scores_player_name_check CHECK (length(player_name) <= 16 AND length(player_name) >= 1);');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixNameLength();