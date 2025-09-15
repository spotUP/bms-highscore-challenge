import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testAchievements() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🔍 Testing achievement system with simple queries...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Test 1: Try to select from achievements table to see what columns exist
    console.log('📋 Testing achievements table...');
    const { data: achievements, error: achError } = await supabase
      .from('achievements')
      .select('*')
      .limit(1);

    if (achError) {
      console.error('❌ Error accessing achievements:', achError);
    } else {
      console.log('✅ Achievements table accessible');
      console.log('Sample achievement structure:', achievements?.[0] || 'No achievements found');
    }

    // Test 2: Try to select from player_achievements
    console.log('\n📋 Testing player_achievements table...');
    const { data: playerAch, error: paError } = await supabase
      .from('player_achievements')
      .select('*')
      .limit(1);

    if (paError) {
      console.error('❌ Error accessing player_achievements:', paError);
    } else {
      console.log('✅ Player achievements table accessible');
      console.log('Sample player achievement:', playerAch?.[0] || 'No player achievements found');
    }

    // Test 3: Try to insert a simple achievement to understand the schema
    console.log('\n🧪 Testing achievement creation...');

    // Get the first tournament
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name')
      .limit(1);

    if (tournaments && tournaments.length > 0) {
      const tournamentId = tournaments[0].id;
      console.log(`Using tournament: ${tournaments[0].name} (${tournamentId})`);

      // Try with minimal fields first
      const testAchievement = {
        name: 'Test Achievement',
        description: 'A test achievement',
        points: 10,
        tournament_id: tournamentId
      };

      const { data: created, error: createError } = await supabase
        .from('achievements')
        .insert(testAchievement)
        .select();

      if (createError) {
        console.error('❌ Error creating test achievement:', createError);
        console.log('This tells us about missing required columns');

        // Let's try to see what columns are actually required
        if (createError.message.includes('violates not-null constraint')) {
          console.log('💡 Some required columns are missing from our insert');
        }
      } else {
        console.log('✅ Test achievement created successfully:', created);

        // Clean up test data
        if (created?.[0]?.id) {
          await supabase
            .from('achievements')
            .delete()
            .eq('id', created[0].id);
          console.log('🧹 Cleaned up test achievement');
        }
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testAchievements();