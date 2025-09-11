import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env from scripts/.env (falls back to process.env)
dotenv.config({ path: 'scripts/.env' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing env. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in scripts/.env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function pass(msg: string) { console.log(`✅ ${msg}`); }
function warn(msg: string) { console.warn(`⚠️  ${msg}`); }
function fail(msg: string) { console.error(`❌ ${msg}`); }

async function verify() {
  console.log('🔎 Verifying storage configuration...');

  let ok = true;
  let hasExecuteSql = false;

  // 1) Bucket existence and settings via Storage API
  try {
    const { data: bucket, error } = await supabase.storage.getBucket('user-uploads');
    if (error && /not found/i.test(error.message || '')) {
      ok = false;
      fail("Bucket 'user-uploads' not found");
    } else if (error) {
      ok = false;
      fail(`Error reading bucket: ${error.message}`);
    } else if (!bucket) {
      ok = false;
      fail("Bucket 'user-uploads' missing (no data returned)");
    } else {
      pass("Bucket 'user-uploads' exists");
      // Check privacy flag if available
      if ((bucket as any).public === false) {
        pass('Bucket is private');
      } else if ((bucket as any).public === true) {
        ok = false; fail('Bucket is public (should be private)');
      } else {
        warn('Bucket privacy could not be determined from API response');
      }

      // Optional: check limits if exposed (may not be returned by API)
      const fileSizeLimit = (bucket as any).file_size_limit ?? (bucket as any).fileSizeLimit;
      const allowed = (bucket as any).allowed_mime_types ?? (bucket as any).allowedMimeTypes;
      if (fileSizeLimit != null) pass(`Per-file limit: ${fileSizeLimit} bytes`);
      else warn('Per-file limit not readable from API (ok)');
      if (allowed) pass(`Allowed MIME types present: ${Array.isArray(allowed) ? allowed.join(', ') : String(allowed)}`);
      else warn('Allowed MIME types not readable from API (ok)');
    }
  } catch (e: any) {
    ok = false;
    fail(`Exception checking bucket: ${e?.message || e}`);
  }

  // Helper to run read-only SQL via execute_sql() RPC
  async function exec(query: string) {
    // Ensure the query starts with SELECT by trimming leading whitespace/newlines
    const q = query.trimStart();
    const { data, error } = await supabase.rpc('execute_sql', { query: q });
    if (error) throw error;
    return data as any[];
  }

  // Probe for execute_sql availability
  try {
    await exec('select 1 as ok');
    hasExecuteSql = true;
    pass('execute_sql RPC available');
  } catch (e: any) {
    hasExecuteSql = false;
    warn('execute_sql RPC not available. Skipping DB catalog checks.');
    console.log('   To enable full verification, run migration file:');
    console.log("   supabase/migrations/20250911092500_add_execute_sql_function.sql in the Supabase SQL Editor");
  }

  // 2) RLS enabled on storage.objects
  if (hasExecuteSql) {
    try {
      const rows = await exec(`
        select c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'storage' and c.relname = 'objects'
      `);
      const enabled = Array.isArray(rows) && rows[0]?.relrowsecurity === true;
      if (enabled) pass('RLS enabled on storage.objects');
      else { ok = false; fail('RLS is NOT enabled on storage.objects'); }
    } catch (e: any) {
      ok = false; fail(`Failed to check RLS: ${e?.message || e}`);
    }
  }

  // 3) Policies on storage.objects
  if (hasExecuteSql) {
    try {
      const pol = await exec(`
        select policyname, cmd, roles
        from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
        order by policyname
      `);
      if (pol.length > 0) {
        pass(`Found ${pol.length} storage.objects policies`);
        const names = pol.map((p: any) => `${p.policyname} [${p.cmd}]`).join(', ');
        console.log('   Policies:', names);
      } else {
        ok = false; fail('No policies found on storage.objects');
      }
    } catch (e: any) {
      ok = false; fail(`Failed to list policies: ${e?.message || e}`);
    }
  }

  // 4) Quota trigger exists (optional)
  if (hasExecuteSql) {
    try {
      const trg = await exec(`
        select tgname from pg_trigger where tgname = 'check_quota_trigger'
      `);
      if (trg.length > 0) pass("Quota trigger 'check_quota_trigger' exists");
      else { warn("Quota trigger 'check_quota_trigger' not found (optional)"); }
    } catch (e: any) {
      warn(`Failed to verify quota trigger (optional): ${e?.message || e}`);
    }
  }

  // 5) Bucket row at DB level
  if (hasExecuteSql) {
    try {
      const rows = await exec(`
        select id, public
        from storage.buckets
        where id = 'user-uploads'
      `);
      if (rows.length === 0) {
        ok = false; fail("storage.buckets row for 'user-uploads' not found");
      } else {
        const row = rows[0];
        if (row.public === false) pass('DB: bucket is private'); else { ok = false; fail('DB: bucket is public'); }
      }
    } catch (e: any) {
      ok = false; fail(`Failed to read storage.buckets: ${e?.message || e}`);
    }
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

verify().catch((e) => {
  fail(`Unexpected error: ${e?.message || e}`);
  process.exit(2);
});
