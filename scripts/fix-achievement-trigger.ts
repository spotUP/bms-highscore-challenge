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

async function fixAchievementTrigger() {
  console.log('🔧 Fixing achievement trigger to handle missing user_id field...');

  try {
    // Drop the problematic trigger
    console.log('🗑️ Dropping existing trigger...');
    const { error: dropError } = await adminClient.rpc('execute_sql', {
      sql: 'DROP TRIGGER IF EXISTS achievement_check_trigger_v2 ON scores;'
    });

    if (dropError) {
      console.error('❌ Error dropping trigger:', dropError);
      return;
    }

    // Create the fixed trigger function
    console.log('🔧 Creating fixed trigger function...');
    const triggerFunction = `
CREATE OR REPLACE FUNCTION trigger_achievement_check_v2()
RETURNS TRIGGER AS $$
DECLARE
  result JSON;
  user_id UUID;
BEGIN
  -- Safely try to get user_id using JSON approach to avoid "field not found" errors
  BEGIN
    user_id := (to_jsonb(NEW)->>'user_id')::uuid;
  EXCEPTION WHEN others THEN
    user_id := NULL;
  END;

  -- If no user_id in record, try to get it from auth context
  IF user_id IS NULL THEN
    user_id := auth.uid();
  END IF;

  -- Check and award achievements
  SELECT check_and_award_achievements_v2(
    NEW.id,
    NEW.player_name,
    NEW.game_id,
    NEW.score,
    NEW.tournament_id,
    user_id
  ) INTO result;

  -- Log if achievements were awarded (optional)
  IF result != '[]'::json AND result IS NOT NULL THEN
    RAISE NOTICE 'Achievements awarded to %: %', NEW.player_name, result;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

    const { error: functionError } = await adminClient.rpc('execute_sql', {
      sql: triggerFunction
    });

    if (functionError) {
      console.error('❌ Error creating function:', functionError);
      return;
    }

    // Create the trigger
    console.log('🎯 Creating trigger...');
    const { error: triggerError } = await adminClient.rpc('execute_sql', {
      sql: `
CREATE TRIGGER achievement_check_trigger_v2
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_achievement_check_v2();
`
    });

    if (triggerError) {
      console.error('❌ Error creating trigger:', triggerError);
      return;
    }

    // Grant permissions
    console.log('🔑 Granting permissions...');
    const { error: permError } = await adminClient.rpc('execute_sql', {
      sql: 'GRANT EXECUTE ON FUNCTION trigger_achievement_check_v2 TO anon, authenticated;'
    });

    if (permError) {
      console.error('❌ Error granting permissions:', permError);
      return;
    }

    console.log('✅ Achievement trigger fixed successfully!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixAchievementTrigger();