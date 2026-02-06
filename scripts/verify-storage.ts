import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'scripts/.env' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

function pass(msg: string) { console.log(`✅ ${msg}`); }
function warn(msg: string) { console.warn(`⚠️  ${msg}`); }
function fail(msg: string) { console.error(`❌ ${msg}`); }

async function verify() {
  console.log('Verifying storage configuration...');

  let ok = true;
  const client = await pool.connect();

  try {
    // 1) Check bucket existence
    try {
      const { rows } = await client.query(
        `SELECT id, public FROM storage.buckets WHERE id = 'user-uploads'`
      );
      if (rows.length === 0) {
        ok = false;
        fail("Bucket 'user-uploads' not found");
      } else {
        pass("Bucket 'user-uploads' exists");
        const row = rows[0];
        if (row.public === false) pass('Bucket is private');
        else { ok = false; fail('Bucket is public (should be private)'); }
      }
    } catch (e: any) {
      ok = false;
      fail(`Exception checking bucket: ${e?.message || e}`);
    }

    // 2) RLS enabled on storage.objects
    try {
      const { rows } = await client.query(`
        SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'storage' AND c.relname = 'objects'
      `);
      const enabled = rows.length > 0 && rows[0].relrowsecurity === true;
      if (enabled) pass('RLS enabled on storage.objects');
      else { ok = false; fail('RLS is NOT enabled on storage.objects'); }
    } catch (e: any) {
      ok = false;
      fail(`Failed to check RLS: ${e?.message || e}`);
    }

    // 3) Policies on storage.objects
    try {
      const { rows: pol } = await client.query(`
        SELECT policyname, cmd, roles
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
        ORDER BY policyname
      `);
      if (pol.length > 0) {
        pass(`Found ${pol.length} storage.objects policies`);
        const names = pol.map((p: any) => `${p.policyname} [${p.cmd}]`).join(', ');
        console.log('   Policies:', names);
      } else {
        ok = false;
        fail('No policies found on storage.objects');
      }
    } catch (e: any) {
      ok = false;
      fail(`Failed to list policies: ${e?.message || e}`);
    }

    // 4) Quota trigger exists (optional)
    try {
      const { rows: trg } = await client.query(
        `SELECT tgname FROM pg_trigger WHERE tgname = 'check_quota_trigger'`
      );
      if (trg.length > 0) pass("Quota trigger 'check_quota_trigger' exists");
      else warn("Quota trigger 'check_quota_trigger' not found (optional)");
    } catch (e: any) {
      warn(`Failed to verify quota trigger (optional): ${e?.message || e}`);
    }
  } finally {
    client.release();
  }

  console.log('\nSummary:');
  if (ok) {
    pass('All storage checks passed');
    process.exit(0);
  } else {
    fail('One or more storage checks failed');
    process.exit(2);
  }
}

verify()
  .catch((e) => {
    fail(`Unexpected error: ${e?.message || e}`);
    process.exit(2);
  })
  .finally(() => pool.end());
