import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables. Please set:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listStoragePolicies() {
  try {
    // List all buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return;
    }

    console.log('\n=== Storage Buckets ===');
    for (const bucket of buckets) {
      console.log(`\nBucket: ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
      
      // Get bucket policies
      const { data: policies, error: policiesError } = await supabase
        .rpc('get_bucket_policies', { bucket_name: bucket.name })
        .select('*');
      
      if (policiesError) {
        console.log('  Policies: Error fetching policies -', policiesError.message);
      } else if (policies && policies.length > 0) {
        console.log('  Policies:');
        policies.forEach(policy => {
          console.log(`    - ${policy.policy_name} (${policy.cmd}): ${policy.definition}`);
        });
      } else {
        console.log('  No explicit policies found');
      }
      
      // List files in bucket (first 10)
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list();
      
      if (filesError) {
        console.log('  Files: Error listing files -', filesError.message);
      } else if (files && files.length > 0) {
        console.log(`  Files (first 10 of ${files.length}):`);
        files.slice(0, 10).forEach(file => {
          console.log(`    - ${file.name} (${(file.metadata?.size / 1024).toFixed(2)} KB)`);
        });
        if (files.length > 10) console.log(`    ... and ${files.length - 10} more`);
      } else {
        console.log('  No files found');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

listStoragePolicies();
