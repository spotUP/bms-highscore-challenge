import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function fixDatabaseSimple() {
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

  console.log('🔧 Simple database fix...');

  try {
    // Test current state
    console.log('1. Testing current state...');

    const testUserRoles = await supabase.from('user_roles').select('*').limit(1);
    const testMembers = await supabase.from('tournament_members').select('*').limit(1);
    const testTournaments = await supabase.from('tournaments').select('*').limit(1);

    console.log('Current state:');
    console.log('- user_roles:', testUserRoles.error ? `❌ ${testUserRoles.error.message}` : '✅ accessible');
    console.log('- tournament_members:', testMembers.error ? `❌ ${testMembers.error.message}` : '✅ accessible');
    console.log('- tournaments:', testTournaments.error ? `❌ ${testTournaments.error.message}` : '✅ accessible');

    // If there are still issues, create a migration to fix them
    if (testUserRoles.error || testMembers.error) {
      console.log('2. Creating emergency migration...');

      const migrationContent = `-- Emergency fix for database recursion
-- Disable RLS and remove all policies

-- Fix user_roles
ALTER TABLE IF EXISTS user_roles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can read their own roles" ON user_roles;
DROP POLICY IF EXISTS "Allow users to read their own roles" ON user_roles;
DROP POLICY IF EXISTS "Enable read access for users to their own roles" ON user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON user_roles;

-- Fix tournament_members
ALTER TABLE IF EXISTS tournament_members DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view their memberships" ON tournament_members;
DROP POLICY IF EXISTS "Users can read their tournament memberships" ON tournament_members;
DROP POLICY IF EXISTS "Allow users to read their own tournament memberships" ON tournament_members;
DROP POLICY IF EXISTS "tournament_members_select_policy" ON tournament_members;

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'user',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Create tournament_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS tournament_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member',
    is_active boolean DEFAULT true,
    joined_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tournament_id)
);

-- Ensure RLS is disabled
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_members DISABLE ROW LEVEL SECURITY;
`;

      // Write migration file
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
      const migrationPath = `supabase/migrations/${timestamp}_emergency_database_fix.sql`;

      require('fs').writeFileSync(migrationPath, migrationContent);
      console.log(`✅ Created migration: ${migrationPath}`);

      // Try to apply via Supabase CLI
      console.log('3. Applying emergency migration...');
      const { execSync } = require('child_process');

      try {
        execSync(`npx supabase db push`, { stdio: 'inherit' });
        console.log('✅ Migration applied successfully');
      } catch (error) {
        console.log('⚠️  Migration command failed, but file created for manual application');
      }
    }

    // Final test
    console.log('4. Final verification...');
    const finalTestUserRoles = await supabase.from('user_roles').select('*').limit(1);
    const finalTestMembers = await supabase.from('tournament_members').select('*').limit(1);

    console.log('Final state:');
    console.log('- user_roles:', finalTestUserRoles.error ? `❌ ${finalTestUserRoles.error.message}` : '✅ accessible');
    console.log('- tournament_members:', finalTestMembers.error ? `❌ ${finalTestMembers.error.message}` : '✅ accessible');

    if (!finalTestUserRoles.error && !finalTestMembers.error) {
      console.log('🎉 Database is now functional!');
    } else {
      console.log('⚠️  Manual intervention may be required');
    }

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixDatabaseSimple();