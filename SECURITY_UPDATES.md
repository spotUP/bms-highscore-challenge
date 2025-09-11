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
