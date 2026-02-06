import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function removeDuplicateAchievements() {
  console.log('Starting to remove duplicate achievements...');

  const client = await pool.connect();
  try {
    // Step 1: Find all duplicate achievements (same name and tournament_id)
    const { rows: duplicates } = await client.query(`
      SELECT name, tournament_id, COUNT(*) as cnt
      FROM achievements
      GROUP BY name, tournament_id
      HAVING COUNT(*) > 1
    `);

    if (duplicates.length === 0) {
      console.log('No duplicate achievements found!');
      return;
    }

    console.log(`Found ${duplicates.length} sets of duplicate achievements`);

    // Step 2: For each set of duplicates, keep the oldest one and delete the rest
    let deletedCount = 0;

    for (const dup of duplicates) {
      console.log(`\nProcessing duplicates for: ${dup.name} (Tournament: ${dup.tournament_id})`);

      const { rows: achievements } = await client.query(
        `SELECT * FROM achievements WHERE name = $1 AND tournament_id = $2 ORDER BY created_at ASC`,
        [dup.name, dup.tournament_id]
      );

      if (achievements.length <= 1) {
        console.log('  No duplicates found (might have been processed already)');
        continue;
      }

      const [oldest, ...rest] = achievements;
      console.log(`  Keeping oldest (ID: ${oldest.id}, Created: ${oldest.created_at})`);

      const idsToDelete = rest.map((a: any) => a.id);
      await client.query(
        `DELETE FROM achievements WHERE id = ANY($1)`,
        [idsToDelete]
      );

      console.log(`  Deleted ${idsToDelete.length} duplicates`);
      deletedCount += idsToDelete.length;
    }

    console.log(`\nDone! Removed ${deletedCount} duplicate achievements`);

    // Step 3: Add unique constraint if it doesn't exist
    console.log('\nEnsuring unique constraint exists...');
    try {
      await client.query(`
        ALTER TABLE achievements
        ADD CONSTRAINT achievements_name_tournament_unique UNIQUE (name, tournament_id)
      `);
      console.log('Unique constraint added successfully');
    } catch (e: any) {
      if (e.code === '42710') {
        console.log('Unique constraint already exists');
      } else {
        console.error('Error adding constraint:', e.message);
      }
    }
  } finally {
    client.release();
  }
}

removeDuplicateAchievements()
  .catch(console.error)
  .finally(() => pool.end());
