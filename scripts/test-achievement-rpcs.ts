import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testAchievementRPCs() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('🔍 Testing achievement RPC functions...');

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get tournament ID
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name')
      .limit(1);

    if (!tournaments || tournaments.length === 0) {
      console.error('❌ No tournaments found');
      return;
    }

    const tournamentId = tournaments[0].id;
    console.log(`🏆 Using tournament: ${tournaments[0].name}`);

    // Test 1: get_recent_achievements_by_tournament
    console.log('\n📋 Testing get_recent_achievements_by_tournament...');
    try {
      const { data, error } = await supabase.rpc('get_recent_achievements_by_tournament', {
        p_tournament_id: tournamentId,
        p_player_name: 'TestPlayer',
        p_since_minutes: 10
      });

      if (error) {
        console.log('❌ Function not found:', error.message);
      } else {
        console.log('✅ Function exists and returned:', data);
      }
    } catch (e) {
      console.log('❌ Function error:', e);
    }

    // Test 2: get_recent_achievements_for_user
    console.log('\n📋 Testing get_recent_achievements_for_user...');
    try {
      const { data, error } = await supabase.rpc('get_recent_achievements_for_user', {
        p_user_id: 'test-user-id',
        p_since_minutes: 10
      });

      if (error) {
        console.log('❌ Function not found:', error.message);
      } else {
        console.log('✅ Function exists and returned:', data);
      }
    } catch (e) {
      console.log('❌ Function error:', e);
    }

    // Test 3: Direct query approach that should work
    console.log('\n📋 Testing direct player_achievements query...');
    const { data: playerAchievements, error: paError } = await supabase
      .from('player_achievements')
      .select(`
        player_name,
        achievements!inner(points)
      `)
      .eq('tournament_id', tournamentId);

    if (paError) {
      console.log('❌ Direct query error:', paError);
    } else {
      console.log('✅ Direct query works, found:', playerAchievements?.length || 0, 'player achievements');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testAchievementRPCs();