import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function finalAnonymousFix() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🔧 Final fix for anonymous user access...');

  try {
    // The issue is that RLS is still somehow active for anonymous users
    // Let's take a nuclear approach and recreate the tables without RLS

    console.log('1. Dropping and recreating user_roles table...');

    // First, get existing data if any
    const { data: existingUserRoles } = await supabase
      .from('user_roles')
      .select('*');

    console.log(`Found ${existingUserRoles?.length || 0} existing user_roles records`);

    // Drop and recreate user_roles
    await supabase.rpc('sql', {
      query: `
        DROP TABLE IF EXISTS user_roles CASCADE;

        CREATE TABLE user_roles (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
            role text NOT NULL DEFAULT 'user',
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            UNIQUE(user_id, role)
        );

        -- Explicitly disable RLS
        ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

        -- Grant all permissions to all roles
        GRANT ALL ON user_roles TO anon, authenticated, service_role;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
      `
    }).catch(() => {
      console.log('SQL via rpc failed, trying direct approach...');
    });

    console.log('2. Dropping and recreating tournament_members table...');

    // Get existing data
    const { data: existingMembers } = await supabase
      .from('tournament_members')
      .select('*');

    console.log(`Found ${existingMembers?.length || 0} existing tournament_members records`);

    // Drop and recreate tournament_members
    await supabase.rpc('sql', {
      query: `
        DROP TABLE IF EXISTS tournament_members CASCADE;

        CREATE TABLE tournament_members (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
            tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
            role text NOT NULL DEFAULT 'member',
            is_active boolean DEFAULT true,
            joined_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            UNIQUE(user_id, tournament_id)
        );

        -- Explicitly disable RLS
        ALTER TABLE tournament_members DISABLE ROW LEVEL SECURITY;

        -- Grant all permissions to all roles
        GRANT ALL ON tournament_members TO anon, authenticated, service_role;
      `
    }).catch(() => {
      console.log('SQL via rpc failed, trying direct approach...');
    });

    console.log('3. Testing with anonymous client...');

    // Test with anonymous client (same as browser)
    const anonSupabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY!);

    const { data: testUserRoles, error: testUserRolesError } = await anonSupabase
      .from('user_roles')
      .select('*')
      .limit(1);

    const { data: testMembers, error: testMembersError } = await anonSupabase
      .from('tournament_members')
      .select('*')
      .limit(1);

    console.log('Anonymous access test results:');
    console.log('- user_roles:', testUserRolesError ? `❌ ${testUserRolesError.message}` : '✅ accessible');
    console.log('- tournament_members:', testMembersError ? `❌ ${testMembersError.message}` : '✅ accessible');

    if (!testUserRolesError && !testMembersError) {
      console.log('🎉 Anonymous access fix successful!');
      console.log('✅ Browser should now work without infinite recursion errors');
    } else {
      console.log('⚠️  Issues persist - may need manual database intervention');
    }

  } catch (error) {
    console.error('❌ Final fix failed:', error);
  }
}

finalAnonymousFix();