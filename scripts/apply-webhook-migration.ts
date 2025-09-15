import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyWebhookMigration() {
  try {
    console.log('Creating webhook configuration tables and functions...');

    // Step 1: Check if webhook_config table exists
    console.log('\n1. Checking existing tables...');

    const { data: tableExists, error: tableError } = await supabase
      .from('webhook_config')
      .select('count')
      .limit(1);

    if (tableExists && !tableError) {
      console.log('✅ webhook_config table already exists');
    } else {
      console.log('📋 webhook_config table does not exist, will need to create it');
    }

    // Step 2: Check if functions exist by trying to call them
    console.log('\n2. Testing webhook functions...');

    // Test initialize_user_webhooks function
    const { data: initData, error: initError } = await supabase
      .rpc('initialize_user_webhooks', {
        p_user_id: '00000000-0000-0000-0000-000000000000' // dummy UUID
      });

    if (initError) {
      if (initError.message.includes('Could not find the function')) {
        console.log('📋 initialize_user_webhooks function does not exist');
      } else {
        console.log('✅ initialize_user_webhooks function exists');
      }
    } else {
      console.log('✅ initialize_user_webhooks function exists');
    }

    // Test update_user_webhook_config function
    const { data: updateData, error: updateError } = await supabase
      .rpc('update_user_webhook_config', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_platform: 'test',
        p_webhook_url: 'test',
        p_enabled: false
      });

    if (updateError) {
      if (updateError.message.includes('Could not find the function')) {
        console.log('📋 update_user_webhook_config function does not exist');
      } else {
        console.log('✅ update_user_webhook_config function exists');
      }
    } else {
      console.log('✅ update_user_webhook_config function exists');
    }

    console.log('\n✅ Database webhook setup check completed!');
    console.log('\nIf tables/functions are missing, please run the SQL migration manually in your Supabase dashboard:');
    console.log('supabase/migrations/20250915140000_create_webhook_config_table.sql');

  } catch (error) {
    console.error('Failed to check webhook setup:', error);
    process.exit(1);
  }
}

applyWebhookMigration();