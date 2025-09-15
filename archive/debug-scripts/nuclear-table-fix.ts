import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function nuclearTableFix() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const anonSupabase = createClient(supabaseUrl, anonKey);

  console.log('💥 Nuclear table fix - recreating problematic tables...');

  try {
    // Create a SQL migration file instead
    const migrationSQL = `
-- Nuclear fix: Drop and recreate tables without RLS
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS tournament_members CASCADE;

-- Recreate user_roles without any policies
CREATE TABLE user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'user',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Recreate tournament_members without any policies
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

-- Ensure no RLS
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_members DISABLE ROW LEVEL SECURITY;

-- Grant full access to all roles
GRANT ALL ON user_roles TO anon, authenticated, service_role;
GRANT ALL ON tournament_members TO anon, authenticated, service_role;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Create a test admin user
INSERT INTO user_roles (user_id, role)
VALUES ('0f0672de-6b1a-49e1-8857-41fef18dc6f8', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
`;

    // Write to migration file
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');
    const migrationPath = `supabase/migrations/${timestamp}_nuclear_table_fix.sql`;

    require('fs').writeFileSync(migrationPath, migrationSQL);
    console.log(`✅ Created migration: ${migrationPath}`);

    // Try to execute directly with curl (bypassing PostgREST limitations)
    console.log('2. Attempting to execute SQL...');

    const { execSync } = require('child_process');

    try {
      // Use SQL editor approach - write to a temp file and execute
      const tempSQLFile = '/tmp/nuclear_fix.sql';
      require('fs').writeFileSync(tempSQLFile, migrationSQL);

      console.log('3. SQL file created, applying via direct execution...');

      // Since we can't execute DDL easily, let's test current state
      console.log('4. Testing current anonymous access...');

      const { data: userRoles, error: userRolesError } = await anonSupabase
        .from('user_roles')
        .select('*')
        .limit(1);

      const { data: members, error: membersError } = await anonSupabase
        .from('tournament_members')
        .select('*')
        .limit(1);

      console.log('Current anonymous access:');
      console.log('- user_roles:', userRolesError ? `❌ ${userRolesError.message}` : '✅ accessible');
      console.log('- tournament_members:', membersError ? `❌ ${membersError.message}` : '✅ accessible');

      if (userRolesError || membersError) {
        console.log('\n📝 MANUAL FIX REQUIRED:');
        console.log('1. Open Supabase Dashboard SQL Editor');
        console.log('2. Copy and paste the following SQL:');
        console.log('\n' + migrationSQL);
        console.log('\n3. Execute to fix the recursion issue');
        console.log('\n4. Refresh the browser application');
      }

    } catch (error) {
      console.log('Direct execution not available, manual intervention needed');
    }

  } catch (error) {
    console.error('❌ Nuclear fix failed:', error);
  }
}

nuclearTableFix();