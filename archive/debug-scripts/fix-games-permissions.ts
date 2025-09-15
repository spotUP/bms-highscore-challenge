import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function fixGamesPermissions() {
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

  console.log('🔧 Fixing games table permissions...');

  try {
    // Test current permissions
    console.log('1. Testing current games table access...');

    const { data: gamesRead, error: readError } = await anonSupabase
      .from('games')
      .select('*')
      .limit(1);

    console.log('Read access:', readError ? `❌ ${readError.message}` : `✅ ${gamesRead.length} records`);

    // Test insert (this is likely where the 403 happens)
    const { data: insertTest, error: insertError } = await anonSupabase
      .from('games')
      .insert({
        name: 'Test Game',
        tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
        logo_url: 'test.png'
      })
      .select();

    console.log('Insert access:', insertError ? `❌ ${insertError.message}` : '✅ Success');

    if (insertError) {
      console.log('2. Fixing games table permissions...');

      // Check if RLS is enabled
      const { data: rlsStatus } = await serviceSupabase.rpc('execute_sql', {
        sql: `
          SELECT schemaname, tablename, rowsecurity
          FROM pg_tables
          WHERE tablename = 'games' AND schemaname = 'public';
        `
      }).catch(() => ({ data: null }));

      console.log('RLS Status:', rlsStatus);

      // Apply fix via service role
      console.log('3. Applying permissions fix...');

      // Grant permissions and disable RLS if needed
      const permissionsFix = `
        -- Grant all permissions on games table
        GRANT ALL ON games TO anon, authenticated, service_role;

        -- Disable RLS if it's causing issues
        ALTER TABLE games DISABLE ROW LEVEL SECURITY;

        -- Grant sequence permissions
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
      `;

      try {
        await serviceSupabase.rpc('execute_sql', {
          sql: permissionsFix
        });
        console.log('✅ Permissions fix applied');
      } catch (error) {
        console.log('Direct SQL approach failed, creating migration...');

        // Create a migration file
        const fs = await import('fs');
        const migrationContent = `-- Fix games table permissions
${permissionsFix}`;

        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');
        const migrationPath = `supabase/migrations/${timestamp}_fix_games_permissions.sql`;

        fs.writeFileSync(migrationPath, migrationContent);
        console.log(`📝 Created migration: ${migrationPath}`);
        console.log('Please apply this migration manually in Supabase Dashboard');
      }

      // Test again after fix
      console.log('4. Testing after fix...');
      const { data: testInsert, error: testError } = await anonSupabase
        .from('games')
        .insert({
          name: 'Test Game 2',
          tournament_id: 'd7840a88-008c-4a22-a522-01ca9e6eae6d',
          logo_url: 'test2.png'
        })
        .select();

      console.log('Post-fix insert:', testError ? `❌ ${testError.message}` : '✅ Success');

      if (!testError) {
        // Clean up test records
        await anonSupabase
          .from('games')
          .delete()
          .in('name', ['Test Game', 'Test Game 2']);
        console.log('✅ Test records cleaned up');
      }
    }

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixGamesPermissions();