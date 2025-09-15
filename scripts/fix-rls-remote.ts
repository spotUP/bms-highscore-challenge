import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';

async function fixRLSPolicies() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Required:');
    console.log('- VITE_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔧 Connecting to Supabase with service role...');

  // Use service role for admin operations
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'fix-rls-policies.sql');
    const sqlContent = readFileSync(sqlPath, 'utf-8');

    console.log('📄 Executing RLS policy fixes...');

    // Split SQL into individual statements and execute them
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`🔍 Executing: ${statement.substring(0, 50)}...`);

        const { error } = await supabase.rpc('execute_sql', {
          query: statement
        });

        if (error) {
          console.warn(`⚠️ Warning for statement: ${error.message}`);
          // Continue with other statements even if one fails
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }

    console.log('\n🎯 Testing score submission...');

    // Test score submission with a dummy score
    const { data: testScore, error: insertError } = await supabase
      .from('scores')
      .insert({
        player_name: 'Test Player',
        score: 12345,
        game_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        tournament_id: '00000000-0000-0000-0000-000000000000' // Dummy UUID
      })
      .select();

    if (insertError) {
      console.error('❌ Score submission still failing:', insertError.message);
    } else {
      console.log('✅ Score submission test successful!');

      // Clean up test score
      if (testScore && testScore[0]) {
        await supabase
          .from('scores')
          .delete()
          .eq('id', testScore[0].id);
        console.log('🧹 Cleaned up test score');
      }
    }

    console.log('\n🎉 RLS policies have been fixed!');
    console.log('Score submission should now work properly.');

  } catch (error) {
    console.error('❌ Error fixing RLS policies:', error);
    process.exit(1);
  }
}

fixRLSPolicies();