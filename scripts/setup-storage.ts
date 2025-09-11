import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env from scripts/.env if present (falls back to process.env)
dotenv.config({ path: 'scripts/.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupStorage() {
  try {
    console.log('🚀 Setting up storage...');
    
    // Create bucket if it doesn't exist (check first)
    console.log('🔍 Checking for existing bucket...');
    const { data: existing, error: getErr } = await supabase.storage.getBucket('user-uploads');
    if (getErr && getErr.message && !/not found/i.test(getErr.message)) {
      console.warn('Warning checking bucket:', getErr.message);
    }
    if (!existing) {
      console.log('📦 Creating bucket user-uploads (private)...');
      const { error: createErr } = await supabase.storage.createBucket('user-uploads', {
        public: false,
      });
      if (createErr && createErr.message !== 'Bucket already exists') {
        throw createErr;
      }
    }
    console.log('✅ Bucket ready');

    // Apply bucket restrictions via update (50MB per-file to align with common defaults)
    // Note: Total per-user quota (100MB) is enforced by DB trigger in migrations.
    console.log('🛠️  Applying bucket limits (50MB/file) and MIME filters...');
    const { error: updateErr } = await supabase.storage.updateBucket('user-uploads', {
      public: false,
      allowedMimeTypes: ['image/*', 'application/pdf'],
      fileSizeLimit: 50 * 1024 * 1024, // 50MB per file (project default max)
    } as any);
    if (updateErr) {
      // Gracefully handle 413/object size messages that some storage gateways return on settings
      if ((updateErr as any)?.statusCode === '413' || /maximum allowed size/i.test((updateErr as any)?.message || '')) {
        console.warn('⚠️  Could not set fileSizeLimit to 50MB via API. This may be restricted by project settings.');
        console.warn('    You can adjust file size limit in the Supabase dashboard if needed.');
      } else {
        throw updateErr;
      }
    }
    
    // Note: RLS policies and triggers are managed by SQL migrations, see:
    //  - supabase/migrations/20240911180000_secure_storage.sql
    // This migration enables RLS on storage.objects, creates per-user folder policies,
    // sets up quota checks, and ensures the 'user-uploads' bucket exists.
    console.log('🔒 RLS policies are applied via database migrations.');
    console.log('   Verify with Supabase SQL editor or psql if needed.');
    
    console.log('\n🎉 Storage setup complete!');
    console.log('Users can now securely upload files to their personal folders');
    
  } catch (error) {
    console.error('❌ Error setting up storage:');
    if (typeof error === 'object') {
      console.error(JSON.stringify(error, null, 2));
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

setupStorage();
