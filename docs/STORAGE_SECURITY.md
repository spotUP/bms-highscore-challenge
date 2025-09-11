# Storage Security Setup

This document outlines the steps to secure your Supabase storage and rotate the anon key.

## 1. Apply Storage Security Migration

Run the following SQL in your Supabase SQL Editor to enable RLS and set up secure storage policies:

```sql
\i supabase/migrations/20240911180000_secure_storage.sql
```

This will:
- Enable RLS on `storage.objects`
- Create policies for public/private buckets
- Set up user-specific file management
- Implement storage quotas (100MB per user)
- Add cleanup for orphaned files

## 2. Rotate Supabase Anon Key

1. Go to your Supabase Dashboard → Project Settings → API
2. Find the "Project API keys" section
3. Click the refresh icon (🔄) next to the `anon`/`public` key
4. Copy the new key
5. Update the following environment variables in all deployment environments:
   ```
   VITE_SUPABASE_ANON_KEY=your_new_anon_key_here
   ```
6. Restart your application services

## 3. Verify Storage Security

Run this query to verify RLS and policies are properly set up:

```sql
-- Check RLS status
SELECT n.nspname as schema,
       c.relname as table,
       c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage'
  AND c.relname = 'objects';

-- Check storage policies
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';
```

## 4. Test Upload Permissions

1. As an anonymous user, verify you can only read from public buckets
2. As an authenticated user, verify you can only manage your own files in the `user-uploads` bucket
3. Verify the 100MB quota is enforced

## 5. Monitor Storage Usage

To monitor storage usage by user:

```sql
SELECT 
  (storage.foldername(name))[1] as user_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM((metadata->>'size')::bigint)) as total_size
FROM storage.objects
WHERE bucket_id = 'user-uploads'
GROUP BY 1
ORDER BY 3 DESC;
```

## Troubleshooting

- If you get permission errors, ensure RLS is enabled on `storage.objects`
- If uploads fail, check the quota trigger and user permissions
- For CORS issues, verify the allowed origins in the bucket settings
