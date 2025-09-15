import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testDatabaseRealtime() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('🧪 Testing database with anon key (simulating browser)...');

  try {
    // Test exactly what the browser would do
    console.log('1. Testing tournaments access...');
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('*');

    if (tournamentsError) {
      console.error('❌ Tournaments error:', tournamentsError);
    } else {
      console.log(`✅ Tournaments: ${tournaments.length} found`);
    }

    console.log('2. Testing user_roles access (problematic table)...');
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (userRolesError) {
      console.error('❌ User roles error:', userRolesError);
    } else {
      console.log(`✅ User roles: ${userRoles.length} found`);
    }

    console.log('3. Testing tournament_members access...');
    const { data: members, error: membersError } = await supabase
      .from('tournament_members')
      .select('*');

    if (membersError) {
      console.error('❌ Tournament members error:', membersError);
    } else {
      console.log(`✅ Tournament members: ${members.length} found`);
    }

    console.log('4. Testing auth state...');
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user ? `Authenticated (${user.id})` : 'Anonymous');

    // Test the specific query that was failing in the browser
    if (user) {
      console.log('5. Testing authenticated user queries...');

      const { data: userRole, error: userRoleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');

      if (userRoleError) {
        console.error('❌ Admin role check error:', userRoleError);
      } else {
        console.log('✅ Admin role check successful');
      }

      const { data: userTournaments, error: userTournamentsError } = await supabase
        .from('tournament_members')
        .select('tournament_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (userTournamentsError) {
        console.error('❌ User tournaments error:', userTournamentsError);
      } else {
        console.log('✅ User tournaments check successful');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDatabaseRealtime();