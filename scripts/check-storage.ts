import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tnsgrwntmnzpaifmutqh.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc2dyd250bW56cGFpZm11dHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDE5MTUyNTgsImV4cCI6MjAxNzQ5MTI1OH0.9qJqgXqYq6QqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq';
  
  const supabase = createClient(supabaseUrl, supabaseKey);

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
      
      // Try to list files in the bucket (first 5)
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list();
      
      if (filesError) {
        console.log('  Error listing files:', filesError.message);
      } else if (files && files.length > 0) {
        console.log(`  Files (first 5 of ${files.length}):`);
        files.slice(0, 5).forEach(file => {
          console.log(`    - ${file.name} (${(file.metadata?.size / 1024).toFixed(2)} KB)`);
        });
        if (files.length > 5) console.log(`    ... and ${files.length - 5} more`);
      } else {
        console.log('  No files found');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
