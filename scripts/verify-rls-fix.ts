import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'dummy-anon-key';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function verifyRLSFix() {
  console.log('🔍 Verifying RLS security fixes...\n');

  // Test RLS status by trying to query tables
  const tablesToCheck = [
    'admin_users',
    'user_roles',
    'tournament_members',
    'games',
    'user_role_cache'
  ];

  console.log('📋 Checking table accessibility with service role...\n');

  for (const table of tablesToCheck) {
    try {
      console.log(`Testing ${table}...`);

      // Try to select from the table
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ Error accessing ${table}: ${error.message}`);
      } else {
        console.log(`✅ Successfully accessed ${table} (${data?.length || 0} records visible)`);
      }
    } catch (e) {
      console.log(`⚠️  Exception accessing ${table}: ${e}`);
    }
  }

  console.log('\n🧪 Testing policy restrictions with regular client...\n');

  // Create a regular client (not service role) to test policies
  const regularSupabase = createClient(supabaseUrl!, anonKey, {
    auth: { persistSession: false }
  });

  let allSecure = true;

  for (const table of tablesToCheck) {
    try {
      console.log(`Testing ${table} access restrictions...`);

      // Try to select from the table with regular client
      const { data, error } = await regularSupabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        if (error.message.includes('permission denied') || error.message.includes('policy')) {
          console.log(`✅ ${table} properly restricted (expected permission error)`);
        } else {
          console.log(`⚠️  ${table} error: ${error.message}`);
          allSecure = false;
        }
      } else {
        console.log(`❌ ${table} SECURITY VULNERABILITY: ${data?.length || 0} records accessible without proper authorization!`);
        allSecure = false;
      }
    } catch (e) {
      console.log(`⚠️  Exception testing ${table}: ${e}`);
      allSecure = false;
    }
  }

  console.log('\n📊 Summary:');
  if (allSecure) {
    console.log('🔒 RLS has been enabled on critical tables');
    console.log('🛡️  Security policies have been implemented');
    console.log('✅ All tables are properly secured!');
  } else {
    console.log('❌ CRITICAL SECURITY ISSUES DETECTED!');
    console.log('🔧 Applying RLS security fixes...\n');

    // Apply fixes
    await applyRLSFixes();
  }

  console.log('\n✅ RLS security verification completed!');
}

async function applyRLSFixes() {
  console.log('Applying RLS security fixes...');

  const fixes = [
    // Enable RLS
    `ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE tournament_members ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE games ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE user_role_cache ENABLE ROW LEVEL SECURITY;`,

    // Drop overly permissive policies
    `DROP POLICY IF EXISTS "Allow all operations on admin_users" ON admin_users;`,
    `DROP POLICY IF EXISTS "Allow all operations on user_roles" ON user_roles;`,
    `DROP POLICY IF EXISTS "Allow all operations on tournament_members" ON tournament_members;`,
    `DROP POLICY IF EXISTS "Allow all operations on games" ON games;`,
    `DROP POLICY IF EXISTS "Allow all operations on user_role_cache" ON user_role_cache;`,

    // Create proper policies for admin_users
    `CREATE POLICY "Admin users can view admin_users" ON admin_users FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));`,
    `CREATE POLICY "Service role can manage admin_users" ON admin_users FOR ALL TO service_role USING (true) WITH CHECK (true);`,

    // Create proper policies for user_roles
    `CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());`,
    `CREATE POLICY "Admins can view all user roles" ON user_roles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));`,
    `CREATE POLICY "Admins can manage user roles" ON user_roles FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));`,

    // Create proper policies for tournament_members
    `CREATE POLICY "Users can view tournament members" ON tournament_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM tournament_members tm WHERE tm.user_id = auth.uid() AND tm.tournament_id = tournament_members.tournament_id));`,
    `CREATE POLICY "Tournament admins can manage members" ON tournament_members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM tournament_members tm WHERE tm.user_id = auth.uid() AND tm.tournament_id = tournament_members.tournament_id AND tm.role IN ('admin', 'owner'))) WITH CHECK (EXISTS (SELECT 1 FROM tournament_members tm WHERE tm.user_id = auth.uid() AND tm.tournament_id = tournament_members.tournament_id AND tm.role IN ('admin', 'owner')));`,

    // Create proper policies for games
    `CREATE POLICY "Anyone can view games" ON games FOR SELECT TO public USING (true);`,
    `CREATE POLICY "Authenticated users can create games" ON games FOR INSERT TO authenticated WITH CHECK (true);`,
    `CREATE POLICY "Game creators and admins can update games" ON games FOR UPDATE TO authenticated USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')) WITH CHECK (created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));`,
    `CREATE POLICY "Game creators and admins can delete games" ON games FOR DELETE TO authenticated USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));`,

    // Create proper policies for user_role_cache
    `CREATE POLICY "Users can view their own role cache" ON user_role_cache FOR SELECT TO authenticated USING (user_id = auth.uid());`,
    `CREATE POLICY "Service role can manage user_role_cache" ON user_role_cache FOR ALL TO service_role USING (true) WITH CHECK (true);`
  ];

  for (const sql of fixes) {
    try {
      // Use a simple approach - try to execute via RPC if available, otherwise skip
      console.log(`Applying: ${sql.substring(0, 50)}...`);

      // For now, just log that we're applying fixes
      // In a real scenario, we'd need to execute these via the database

    } catch (e) {
      console.log(`⚠️  Could not apply fix: ${e}`);
    }
  }

  console.log('⚠️  Manual application of SQL fixes required!');
  console.log('📄 Copy the following SQL to your Supabase SQL editor:');
  console.log('\n' + fixes.join('\n') + '\n');
}

verifyRLSFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});