#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixProfilesTable() {
  console.log('🔧 Ensuring profiles table exists with correct structure...\n');

  try {
    // Check if profiles table exists
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'profiles');

    if (tablesError) {
      console.error('❌ Error checking for profiles table:', tablesError);
      return;
    }

    const profilesTableExists = tables && tables.length > 0;
    console.log(`📊 Profiles table exists: ${profilesTableExists}`);

    if (!profilesTableExists) {
      console.log('🔨 Creating profiles table...');

      // Create the profiles table
      const createTableSQL = `
        CREATE TABLE profiles (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
          username TEXT,
          full_name TEXT,
          avatar_url TEXT,
          fullscreen_enabled BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      const { error: createError } = await supabase.rpc('exec_sql', {
        sql_query: createTableSQL
      });

      if (createError) {
        console.error('❌ Error creating profiles table:', createError);
        return;
      }

      console.log('✅ Profiles table created successfully');
    }

    // Enable RLS
    console.log('🔐 Enabling RLS on profiles table...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql_query: 'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;'
    });

    if (rlsError && !rlsError.message.includes('already exists')) {
      console.error('❌ Error enabling RLS:', rlsError);
    } else {
      console.log('✅ RLS enabled on profiles table');
    }

    // Drop existing policies to avoid conflicts
    console.log('🧹 Cleaning up existing policies...');
    const dropPoliciesSQL = `
      DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
      DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
      DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
    `;

    await supabase.rpc('exec_sql', { sql_query: dropPoliciesSQL });

    // Create RLS policies
    console.log('📋 Creating RLS policies...');
    const policiesSQL = `
      -- Allow users to read their own profile
      CREATE POLICY "profiles_select_own"
      ON profiles FOR SELECT
      USING (auth.uid() = user_id);

      -- Allow users to update their own profile
      CREATE POLICY "profiles_update_own"
      ON profiles FOR UPDATE
      USING (auth.uid() = user_id);

      -- Allow users to insert their own profile
      CREATE POLICY "profiles_insert_own"
      ON profiles FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    `;

    const { error: policiesError } = await supabase.rpc('exec_sql', {
      sql_query: policiesSQL
    });

    if (policiesError) {
      console.error('❌ Error creating policies:', policiesError);
      return;
    }

    console.log('✅ RLS policies created successfully');

    // Create trigger for updated_at
    console.log('⚡ Creating updated_at trigger...');
    const triggerSQL = `
      CREATE OR REPLACE FUNCTION update_profiles_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_profiles_updated_at_trigger ON profiles;
      CREATE TRIGGER update_profiles_updated_at_trigger
        BEFORE UPDATE ON profiles
        FOR EACH ROW EXECUTE FUNCTION update_profiles_updated_at();
    `;

    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql_query: triggerSQL
    });

    if (triggerError) {
      console.error('❌ Error creating trigger:', triggerError);
      return;
    }

    console.log('✅ Updated_at trigger created successfully');

    // Create automatic profile creation trigger
    console.log('🤖 Creating automatic profile creation trigger...');
    const autoCreateSQL = `
      CREATE OR REPLACE FUNCTION create_user_profile()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.profiles (user_id, username, full_name, fullscreen_enabled)
        VALUES (
          NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
          false
        );
        RETURN NEW;
      END;
      $$ language 'plpgsql' SECURITY DEFINER;

      DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;
      CREATE TRIGGER create_profile_on_signup
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION create_user_profile();
    `;

    const { error: autoCreateError } = await supabase.rpc('exec_sql', {
      sql_query: autoCreateSQL
    });

    if (autoCreateError) {
      console.error('❌ Error creating auto-profile trigger:', autoCreateError);
      return;
    }

    console.log('✅ Automatic profile creation trigger created successfully');

    // Test the profiles table
    console.log('🧪 Testing profiles table access...');
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Error testing profiles table:', testError);
      return;
    }

    console.log('✅ Profiles table is accessible');

    console.log('\n🎉 Profiles table setup completed successfully!');
    console.log('✅ Table created with correct structure');
    console.log('✅ RLS policies configured');
    console.log('✅ Auto-creation trigger installed');
    console.log('✅ Table is accessible');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the fix
fixProfilesTable();