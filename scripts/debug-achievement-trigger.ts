import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function debugAchievementTrigger() {
  console.log('🔍 Debugging achievement trigger system...\n');

  try {
    // Check if the trigger function exists
    console.log('1. Checking for trigger function...');
    const { data: functions, error: funcError } = await supabase
      .rpc('get_function_info', { function_name: 'check_achievements' });

    if (funcError) {
      console.log('❌ Error checking functions:', funcError);
    } else {
      console.log('✅ Function check result:', functions);
    }

    // Check if the trigger exists
    console.log('\n2. Checking for trigger...');
    const { data: triggers, error: trigError } = await supabase
      .from('information_schema.triggers')
      .select('*')
      .eq('trigger_name', 'achievement_trigger')
      .eq('event_object_table', 'scores');

    if (trigError) {
      console.log('❌ Error checking triggers:', trigError);
    } else if (triggers && triggers.length > 0) {
      console.log('✅ Found trigger:', triggers[0]);
    } else {
      console.log('❌ No trigger found');
    }

    // Test a direct score insertion with achievement checking
    console.log('\n3. Testing direct score insertion...');

    // First, ensure we have a user to work with
    const testPlayer = 'DEBUG_TEST_' + Math.random().toString(36).substring(7);

    // Create a test score
    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .insert({
        player_name: testPlayer,
        game_name: 'Test Game',
        score: 25000,
        user_id: null // Testing with null user_id
      })
      .select()
      .single();

    if (scoreError) {
      console.log('❌ Error inserting test score:', scoreError);
    } else {
      console.log('✅ Test score inserted:', scoreData);
    }

    // Check if achievements were awarded
    console.log('\n4. Checking for awarded achievements...');
    const { data: achievements, error: achError } = await supabase
      .from('user_achievements')
      .select(`
        *,
        achievements (
          name,
          description
        )
      `)
      .eq('player_name', testPlayer);

    if (achError) {
      console.log('❌ Error checking achievements:', achError);
    } else if (achievements && achievements.length > 0) {
      console.log('✅ Found achievements:', achievements);
    } else {
      console.log('❌ No achievements found for test player');
    }

    // Clean up
    console.log('\n5. Cleaning up test data...');
    await supabase.from('user_achievements').delete().eq('player_name', testPlayer);
    await supabase.from('scores').delete().eq('player_name', testPlayer);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugAchievementTrigger().catch(console.error);