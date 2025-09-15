import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/integrations/supabase/types';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing required environment variables');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createAdminUser(email: string, password: string) {
  try {
    console.log(`Creating admin user: ${email}`);
    
    // Create the user
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('No user data returned');

    const userId = authData.user.id;
    console.log(`User created with ID: ${userId}`);

    // Add admin role to user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert([
        { user_id: userId, role: 'admin' },
      ], {
        onConflict: 'user_id,role',
      });

    if (roleError) throw roleError;
    
    console.log('Admin role assigned successfully');
    console.log('Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${'*'.repeat(password.length)}`);
    
    return authData.user;
  } catch (error) {
    console.error('Error creating admin user:');
    console.error(error);
    process.exit(1);
  }
}

// Get email and password from command line arguments or use defaults
const email = process.argv[2] || 'spotup@gmail.com';
const password = process.argv[3] || 'D0pest1!D0pest1!';

// Run the script
createAdminUser(email, password);
