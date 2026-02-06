import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const repoRoot = process.cwd();
const dbMigrationsDir = path.join(repoRoot, 'db', 'migrations');

const listSqlFiles = (dir: string) =>
  readdirSync(dir)
    .filter(file => file.endsWith('.sql'))
    .map(file => ({ file, fullPath: path.join(dir, file) }));

const collectMigrations = () => {
  return listSqlFiles(dbMigrationsDir).sort((a, b) => a.file.localeCompare(b.file));
};

const pool = new Pool({ connectionString: DATABASE_URL });

const ensureMigrationsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
};

const alreadyApplied = async (filename: string) => {
  const result = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
  return result.rowCount > 0;
};

const applyMigration = async (filename: string, sql: string) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const run = async () => {
  await ensureMigrationsTable();
  const migrations = collectMigrations();

  for (const migration of migrations) {
    if (await alreadyApplied(migration.file)) {
      console.log(`↪︎ Skipping ${migration.file} (already applied)`);
      continue;
    }
    const sql = readFileSync(migration.fullPath, 'utf8');
    console.log(`▶ Applying ${migration.file}`);
    await applyMigration(migration.file, sql);
  }

  console.log('✅ Migrations complete');
  await pool.end();
};

run().catch(error => {
  console.error('Migration failed:', error);
  pool.end().catch(() => undefined);
  process.exit(1);
});
