# Security Updates - Next Steps

## 1. Apply Storage Security Migration

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Paste the contents of `supabase/migrations/20240911180000_secure_storage.sql`
4. Click "Run" or press CMD+Enter (Mac) / Ctrl+Enter (Windows/Linux)

### Option B: Using Command Line

1. Install dependencies if needed:
   ```bash
   npm install @supabase/supabase-js typescript tsx
   ```

2. Run the migration script (requires service role key):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_project_url \
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
   npx tsx scripts/apply-storage-migration.ts
   ```

## 2. Rotate Supabase Anon Key

1. Go to Supabase Dashboard → Project Settings → API
2. Find the "Project API keys" section
3. Click the refresh icon (🔄) next to the `anon`/`public` key
4. Copy the new key
5. Update the following environment variables in all deployment environments:
   ```
   VITE_SUPABASE_ANON_KEY=your_new_anon_key_here
   ```
6. Restart your application services

## 3. Deploy Security Headers

### For Vercel:
1. The `vercel.json` file is already configured
2. Commit and push changes to trigger a new deployment

### For Netlify:
1. The `netlify.toml` file is already configured
2. Commit and push changes to trigger a new deployment

## 4. Verify Security Settings

1. **Test File Uploads**
   - Try uploading files as different user roles
   - Verify the 100MB quota is enforced
   - Check that users can only access their own files

2. **Check Security Headers**
   ```bash
   curl -I https://your-site.com/
   ```
   Or use:
   - [Security Headers](https://securityheaders.com/)
   - [Mozilla Observatory](https://observatory.mozilla.org/)

3. **Verify Storage Policies**
   - Go to Supabase Dashboard → Storage → Policies
   - Ensure the policies match those in the migration file

## 5. Monitor for Issues

1. Check the Supabase logs for any errors
2. Monitor your application's error tracking
3. Watch for any CSP violations in browser consoles

## Rollback Plan

If you encounter issues:

1. **Revert the deployment** to the previous version
2. **Disable the new RLS policies** if needed:
   ```sql
   ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
   ```
3. **Roll back the anon key** if necessary
4. **Check the Supabase logs** for detailed error messages

## Support

If you need assistance:
1. Check the [Supabase Documentation](https://supabase.com/docs)
2. Review the error logs in your Supabase Dashboard
3. Contact Supabase Support if needed

---

## 6. Storage Verification: Status and How-To

Status (2025-09-11): Completed and verified for private bucket `user-uploads`.

What’s in place
- Private bucket `user-uploads` with per-file limit (50MB) and allowed MIME types (image/*, application/pdf) set via API.
- RLS enabled on `storage.objects` with per-user folder access policies.
- App-side Storage tester and signed-image previews in place.

Re-verify anytime
```
npm run verify-storage
```
This checks:
- Bucket exists and is private
- Allowed MIME types and per-file limit
- RLS enabled on `storage.objects` and policies present (via execute_sql RPC)

UI smoke test (Admin → System → Storage Tester)
- Upload an image/PDF to `user-uploads/{auth.uid}/...`
- Confirm thumbnail appears (signed URL)
- “Open” (signed URL) and “Download” (SDK) succeed
- “Delete” removes the object
- Attempt to list another user’s folder: should be blocked

Key RLS policies on `storage.objects` (roles: authenticated)
- INSERT (WITH CHECK):
  `bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text`
- SELECT (USING):
  `bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text`
- UPDATE (USING + WITH CHECK) [optional if not renaming/moving]:
  same predicate as above
- DELETE (USING):
  `bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text`

Notes
- Private objects must be accessed via signed URLs or SDK downloads; direct GETs will 400/401 by design.
- If Storage policies must be edited, prefer the Supabase Dashboard (Storage bucket Policies tab or Database → Tables → storage.objects → Policies). Owner scope is required.
- If database credentials were ever shared externally, rotate the Postgres password in Dashboard → Project Settings → Database → Reset Password and update any direct Postgres clients.
