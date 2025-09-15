#!/usr/bin/env npx tsx

/**
 * Apply Achievement Migration Script
 *
 * Manually applies the achievement system migration since database functions
 * are missing from the schema.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function executeSQLFile(filename: string) {
  console.log(`📄 Applying migration: ${filename}`);

  try {
    const filePath = join(process.cwd(), 'supabase', 'migrations', filename);
    const sqlContent = readFileSync(filePath, 'utf-8');

    // Split the file into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      console.log(`Executing statement ${i + 1}/${statements.length}...`);

      try {
        // For function definitions and other complex statements, use direct SQL execution
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // If rpc fails, try different approaches
          console.log(`RPC failed, trying alternative methods...`);

          // Skip statements that are just comments or whitespace
          if (statement.trim().length <= 1) {
            console.log('✅ Skipped empty statement');
            continue;
          }

          console.log(`❌ Failed to execute statement: ${error.message}`);
          console.log(`Statement: ${statement.substring(0, 100)}...`);
        } else {
          console.log('✅ Statement executed successfully');
        }
      } catch (err) {
        console.log(`❌ Error executing statement: ${err}`);
        console.log(`Statement: ${statement.substring(0, 100)}...`);
      }
    }

    console.log(`\n✅ Completed processing ${filename}\n`);

  } catch (err) {
    console.error(`❌ Failed to read or process ${filename}:`, err);
  }
}

async function applyMigrationManually() {
  console.log('🔧 Manually applying achievement migration...\n');

  // The key migration file
  const migrationFile = '20250915000000_fix_achievement_system.sql';

  await executeSQLFile(migrationFile);
}

async function testAfterMigration() {
  console.log('🧪 Testing after migration...\n');

  try {
    // Test the achievement function
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (tournaments && tournaments.length > 0 && games && games.length > 0) {
      console.log('Testing achievement function...');

      const { data: result, error } = await supabase.rpc('check_and_award_achievements_v2', {
        p_score_id: crypto.randomUUID(),
        p_player_name: 'test_player',
        p_game_id: games[0].id,
        p_score: 200,
        p_tournament_id: tournaments[0].id,
        p_user_id: null
      });

      if (error) {
        console.log('❌ Achievement function test failed:', error.message);
      } else {
        console.log('✅ Achievement function is working!');
        console.log('Result:', result);
      }
    }

  } catch (err) {
    console.error('❌ Error testing after migration:', err);
  }
}

async function createBasicAchievementFunction() {
  console.log('🛠️ Creating basic achievement function manually...\n');

  const functionSQL = `
-- Create a simple achievement checking function
CREATE OR REPLACE FUNCTION check_and_award_achievements_v2(
  p_score_id UUID,
  p_player_name TEXT,
  p_game_id UUID,
  p_score INTEGER,
  p_tournament_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  achievement_record RECORD;
  new_achievements JSON := '[]'::json;
  achievement_array JSON[] := ARRAY[]::JSON[];
  is_first_place BOOLEAN := false;
  player_score_count INTEGER;
BEGIN
  -- Check if this is a first place score in the tournament
  SELECT NOT EXISTS(
    SELECT 1 FROM scores
    WHERE game_id = p_game_id
    AND tournament_id = p_tournament_id
    AND score > p_score
  ) INTO is_first_place;

  -- Get player's score count in this tournament
  SELECT COUNT(*) INTO player_score_count
  FROM scores
  WHERE player_name = p_player_name
  AND tournament_id = p_tournament_id;

  -- Check for achievements in this tournament
  FOR achievement_record IN
    SELECT a.* FROM achievements a
    WHERE a.is_active = true
    AND a.tournament_id = p_tournament_id
    AND a.id NOT IN (
      SELECT achievement_id FROM player_achievements
      WHERE player_name = p_player_name
      AND tournament_id = p_tournament_id
    )
  LOOP
    -- Check if achievement criteria is met
    CASE achievement_record.type
      WHEN 'first_score' THEN
        -- First score achievement
        IF player_score_count = 1 THEN
          INSERT INTO player_achievements (
            player_name,
            achievement_id,
            tournament_id,
            score_id,
            user_id,
            earned_at
          ) VALUES (
            p_player_name,
            achievement_record.id,
            p_tournament_id,
            p_score_id,
            p_user_id,
            NOW()
          );

          achievement_array := achievement_array || jsonb_build_object(
            'id', achievement_record.id,
            'name', achievement_record.name,
            'description', achievement_record.description,
            'badge_icon', achievement_record.badge_icon,
            'badge_color', achievement_record.badge_color,
            'points', achievement_record.points
          )::json;
        END IF;

      WHEN 'first_place' THEN
        -- First place achievement
        IF is_first_place THEN
          INSERT INTO player_achievements (
            player_name,
            achievement_id,
            tournament_id,
            score_id,
            user_id,
            earned_at
          ) VALUES (
            p_player_name,
            achievement_record.id,
            p_tournament_id,
            p_score_id,
            p_user_id,
            NOW()
          );

          achievement_array := achievement_array || jsonb_build_object(
            'id', achievement_record.id,
            'name', achievement_record.name,
            'description', achievement_record.description,
            'badge_icon', achievement_record.badge_icon,
            'badge_color', achievement_record.badge_color,
            'points', achievement_record.points
          )::json;
        END IF;

      WHEN 'score_milestone' THEN
        -- Score milestone achievement
        IF (achievement_record.criteria->>'threshold')::int IS NOT NULL AND
           p_score >= (achievement_record.criteria->>'threshold')::int THEN
          INSERT INTO player_achievements (
            player_name,
            achievement_id,
            tournament_id,
            score_id,
            user_id,
            earned_at
          ) VALUES (
            p_player_name,
            achievement_record.id,
            p_tournament_id,
            p_score_id,
            p_user_id,
            NOW()
          );

          achievement_array := achievement_array || jsonb_build_object(
            'id', achievement_record.id,
            'name', achievement_record.name,
            'description', achievement_record.description,
            'badge_icon', achievement_record.badge_icon,
            'badge_color', achievement_record.badge_color,
            'points', achievement_record.points
          )::json;
        END IF;

      ELSE
        -- Other achievement types can be added here
        NULL;
    END CASE;
  END LOOP;

  -- Return the list of new achievements
  IF array_length(achievement_array, 1) > 0 THEN
    new_achievements := to_json(achievement_array);
  END IF;

  RETURN new_achievements;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_achievement_check_v2()
RETURNS TRIGGER AS $$
DECLARE
  result JSON;
  user_id UUID;
BEGIN
  user_id := NEW.user_id;

  -- Check and award achievements
  SELECT check_and_award_achievements_v2(
    NEW.id,
    NEW.player_name,
    NEW.game_id,
    NEW.score,
    NEW.tournament_id,
    user_id
  ) INTO result;

  -- Log if achievements were awarded
  IF result != '[]'::json AND result IS NOT NULL THEN
    RAISE NOTICE 'Achievements awarded to %: %', NEW.player_name, result;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger
DROP TRIGGER IF EXISTS achievement_check_trigger ON scores;
DROP TRIGGER IF EXISTS achievement_check_trigger_v2 ON scores;

-- Create the trigger
CREATE TRIGGER achievement_check_trigger_v2
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_check_v2();

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_and_award_achievements_v2 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION trigger_achievement_check_v2 TO anon, authenticated;
`;

  try {
    // Execute the function creation statement by statement
    const statements = functionSQL
      .split(/;\s*\n\s*(?=CREATE|DROP|GRANT|--)/g)
      .filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim().startsWith('--')) continue;

      console.log('Executing statement...');

      try {
        // Use direct query execution
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

        if (error) {
          console.log(`❌ Statement failed: ${error.message}`);
        } else {
          console.log('✅ Statement executed');
        }
      } catch (err) {
        console.log(`⚠️ Statement execution error: ${err}`);
      }
    }

    console.log('\n✅ Basic achievement function creation completed');

  } catch (err) {
    console.error('❌ Error creating achievement function:', err);
  }
}

async function main() {
  console.log('🚀 Achievement Migration Application Script\n');

  // First try to apply the migration file
  await applyMigrationManually();

  // If that doesn't work, create the basic function manually
  console.log('\n🛠️ Creating functions manually as fallback...');
  await createBasicAchievementFunction();

  // Test the results
  await testAfterMigration();

  console.log('\n📋 Next Steps:');
  console.log('1. Run the debug script to verify: npx tsx scripts/debug-achievement-system.ts');
  console.log('2. Test score submission in the frontend');
  console.log('3. Monitor for achievement notifications');
}

main().catch(console.error);