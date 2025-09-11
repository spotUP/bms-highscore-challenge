import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  // Load environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Requires service role for migrations

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing required environment variables');
    console.error('Required:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY (with service_role secret)');
    process.exit(1);
  }

  // Initialize Supabase client with service role
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read the SQL file
    const sqlPath = join(__dirname, '../supabase/migrations/20240911180000_secure_storage.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    console.log('Applying storage security migration...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('pg_temp.execute_sql', { sql });
    
    if (error) {
      console.error('Error executing migration:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('\nNext steps:');
    console.log('1. Rotate your Supabase anon key in Project Settings → API');
    console.log('2. Deploy your application with the new security headers');
    console.log('3. Test file uploads with different user roles');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Create a temporary function to execute raw SQL
const setupTempFunction = `
  create or replace function pg_temp.execute_sql(sql text)
  returns json
  language plpgsql
  as $$
  begin
    execute sql;
    return json_build_object('status', 'success');
  exception when others then
    return json_build_object('error', sqlerrm, 'detail', sqlstate);
  end;
  $$;
`;

// Run the script
main();
