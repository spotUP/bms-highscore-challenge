import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function verifyFix() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  // Test with anonymous client (same as browser)
  const supabase = createClient(supabaseUrl, anonKey);

  console.log('🧪 Verifying fix with anonymous access...');

  try {
    // Test the exact queries that were failing
    console.log('1. Testing user_roles access...');
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('*');

    console.log('2. Testing tournament_members access...');
    const { data: members, error: membersError } = await supabase
      .from('tournament_members')
      .select('*');

    console.log('3. Testing tournaments access...');
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('*');

    console.log('\n🎯 Results:');
    console.log('- user_roles:', userRolesError ? `❌ ${userRolesError.message}` : `✅ ${userRoles.length} records accessible`);
    console.log('- tournament_members:', membersError ? `❌ ${membersError.message}` : `✅ ${members.length} records accessible`);
    console.log('- tournaments:', tournamentsError ? `❌ ${tournamentsError.message}` : `✅ ${tournaments.length} records accessible`);

    if (!userRolesError && !membersError && !tournamentsError) {
      console.log('\n🎉 SUCCESS! All tables accessible without infinite recursion!');
      console.log('✅ Browser should now work perfectly');
    } else {
      console.log('\n⚠️  Some issues remain');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyFix();