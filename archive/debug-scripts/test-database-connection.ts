import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testDatabaseConnection() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('🧪 Testing database connection...');

  try {
    // Test 1: user_roles query (was causing recursion)
    console.log('1. Testing user_roles query...');
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('role')
      .limit(1);

    if (userRolesError) {
      console.error('❌ user_roles test failed:', userRolesError);
    } else {
      console.log('✅ user_roles test passed');
    }

    // Test 2: tournament_members query (was also failing)
    console.log('2. Testing tournament_members query...');
    const { data: members, error: membersError } = await supabase
      .from('tournament_members')
      .select('id,user_id,tournament_id,role,is_active')
      .limit(1);

    if (membersError) {
      console.error('❌ tournament_members test failed:', membersError);
    } else {
      console.log('✅ tournament_members test passed');
    }

    // Test 3: tournaments query
    console.log('3. Testing tournaments query...');
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id,name,is_public')
      .limit(1);

    if (tournamentsError) {
      console.error('❌ tournaments test failed:', tournamentsError);
    } else {
      console.log('✅ tournaments test passed');
    }

    console.log('🎉 All database tests completed!');

  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    process.exit(1);
  }
}

testDatabaseConnection();