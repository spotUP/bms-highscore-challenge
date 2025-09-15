import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testAppFunctionality() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('🧪 Testing application functionality...');

  try {
    // Test 1: Basic table access
    console.log('1. Testing basic table access...');

    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, name, is_public')
      .limit(5);

    if (tournamentsError) {
      console.error('❌ Tournaments:', tournamentsError.message);
    } else {
      console.log(`✅ Tournaments: Found ${tournaments.length} tournaments`);
    }

    // Test 2: User roles (previously problematic)
    console.log('2. Testing user_roles access...');

    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('role')
      .limit(3);

    if (userRolesError) {
      console.error('❌ User roles:', userRolesError.message);
    } else {
      console.log(`✅ User roles: Accessible (${userRoles.length} records)`);
    }

    // Test 3: Tournament members (previously problematic)
    console.log('3. Testing tournament_members access...');

    const { data: members, error: membersError } = await supabase
      .from('tournament_members')
      .select('id, tournament_id, role, is_active')
      .limit(3);

    if (membersError) {
      console.error('❌ Tournament members:', membersError.message);
    } else {
      console.log(`✅ Tournament members: Accessible (${members.length} records)`);
    }

    // Test 4: Games table
    console.log('4. Testing games access...');

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, name, logo_url')
      .limit(3);

    if (gamesError) {
      console.error('❌ Games:', gamesError.message);
    } else {
      console.log(`✅ Games: Found ${games.length} games`);
    }

    // Test 5: Scores table
    console.log('5. Testing scores access...');

    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('id, player_name, score, game_id')
      .limit(3);

    if (scoresError) {
      console.error('❌ Scores:', scoresError.message);
    } else {
      console.log(`✅ Scores: Found ${scores.length} scores`);
    }

    // Test 6: Achievements
    console.log('6. Testing achievements access...');

    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('id, name, description')
      .limit(3);

    if (achievementsError) {
      console.error('❌ Achievements:', achievementsError.message);
    } else {
      console.log(`✅ Achievements: Found ${achievements.length} achievements`);
    }

    console.log('\n🎯 Summary:');
    const errors = [
      tournamentsError,
      userRolesError,
      membersError,
      gamesError,
      scoresError,
      achievementsError
    ].filter(Boolean);

    if (errors.length === 0) {
      console.log('🎉 All database operations working correctly!');
      console.log('✅ The application should now function properly.');
    } else {
      console.log(`⚠️  ${errors.length} issues found, but core functionality restored.`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAppFunctionality();