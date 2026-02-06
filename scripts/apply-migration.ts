import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function applyMigration() {
  console.log('Applying image schema migration...');

  const migrations = [
    'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS screenshot_url TEXT',
    'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS cover_url TEXT',
    'ALTER TABLE games_database ADD COLUMN IF NOT EXISTS logo_url TEXT',
    'CREATE INDEX IF NOT EXISTS idx_games_database_screenshot ON games_database(screenshot_url) WHERE screenshot_url IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_games_database_cover ON games_database(cover_url) WHERE cover_url IS NOT NULL'
  ];

  const client = await pool.connect();
  try {
    for (const sql of migrations) {
      console.log(`Running: ${sql}`);
      try {
        await client.query(sql);
        console.log('Success');
      } catch (error: any) {
        console.error('Error:', error.message);
      }
    }
  } finally {
    client.release();
  }

  console.log('Migration complete!');
}

applyMigration()
  .catch(console.error)
  .finally(() => pool.end());
