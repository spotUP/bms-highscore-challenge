import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔄 Applying image schema migration...');

  // Apply the changes one by one
  const migrations = [
    'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS screenshot_url TEXT',
    'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS cover_url TEXT',
    'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS logo_url TEXT',
    'CREATE INDEX IF NOT EXISTS idx_games_database_screenshot ON games_database(screenshot_url) WHERE screenshot_url IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_games_database_cover ON games_database(cover_url) WHERE cover_url IS NOT NULL'
  ];

  for (const sql of migrations) {
    console.log(`Running: ${sql}`);
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Success');
    }
  }

  console.log('🎉 Migration complete!');
}

// Run the migration
applyMigration();