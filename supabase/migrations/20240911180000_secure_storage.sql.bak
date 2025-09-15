-- Enable RLS on storage.objects if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
  ) THEN
    RAISE NOTICE 'storage.objects table does not exist, skipping RLS setup';
  ELSIF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on storage.objects';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error enabling RLS on storage.objects: %', SQLERRM;
END
$$;

-- Create a policy to allow public read access to public buckets
CREATE OR REPLACE FUNCTION storage.is_public_bucket(bucket_id text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM storage.buckets 
    WHERE id = bucket_id AND public = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policy for public read access to public buckets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public read access for public buckets'
  ) THEN
    CREATE POLICY "Public read access for public buckets" 
    ON storage.objects 
    FOR SELECT 
    USING (storage.is_public_bucket(bucket_id));
    
    RAISE NOTICE 'Created public read policy for public buckets';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating public read policy: %', SQLERRM;
END
$$;

-- Policy for authenticated users to upload to their own folders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload to their own folders'
  ) THEN
    CREATE POLICY "Users can upload to their own folders" 
    ON storage.objects 
    FOR INSERT 
    WITH CHECK (
      bucket_id = 'user-uploads' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    RAISE NOTICE 'Created user upload policy';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user upload policy: %', SQLERRM;
END
$$;

-- Policy for users to manage their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can manage their own files'
  ) THEN
    CREATE POLICY "Users can manage their own files" 
    ON storage.objects 
    FOR ALL 
    USING (
      bucket_id = 'user-uploads' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    ) 
    WITH CHECK (
      bucket_id = 'user-uploads' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    RAISE NOTICE 'Created user file management policy';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user file management policy: %', SQLERRM;
END
$$;

-- Create a bucket for user uploads if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Enable CORS for the Supabase domain
UPDATE storage.buckets 
SET cors_origins = ARRAY['http://localhost:3000', 'https://*.supabase.co']
WHERE id = 'user-uploads';

-- Create a helper function to get user's storage quota (in bytes)
CREATE OR REPLACE FUNCTION storage.get_user_quota(user_id uuid)
RETURNS bigint AS $$
  SELECT 100 * 1024 * 1024; -- 100MB per user
$$ LANGUAGE sql SECURITY DEFINER;

-- Create a function to check storage quota before upload
CREATE OR REPLACE FUNCTION storage.check_quota()
RETURNS TRIGGER AS $$
DECLARE
  user_id uuid;
  used_bytes bigint;
  quota_bytes bigint;
BEGIN
  -- Get the user ID from the path
  user_id := (string_to_array(NEW.name, '/'))[1]::uuid;
  
  -- Calculate current usage
  SELECT COALESCE(SUM((payload->>'size')::bigint), 0)
  INTO used_bytes
  FROM storage.objects
  WHERE bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = user_id::text;
  
  -- Get user's quota
  SELECT storage.get_user_quota(user_id) INTO quota_bytes;
  
  -- Check if the new file would exceed the quota
  IF used_bytes + COALESCE(NEW.metadata->>'size'::text, '0')::bigint > quota_bytes THEN
    RAISE EXCEPTION 'Storage quota exceeded. Used: % bytes, Quota: % bytes', 
      used_bytes, quota_bytes;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger for quota checking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'check_quota_trigger'
  ) THEN
    CREATE TRIGGER check_quota_trigger
    BEFORE INSERT ON storage.objects
    FOR EACH ROW
    WHEN (NEW.bucket_id = 'user-uploads')
    EXECUTE FUNCTION storage.check_quota();
    
    RAISE NOTICE 'Created storage quota trigger';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating quota trigger: %', SQLERRM;
END
$$;

-- Create a function to clean up orphaned files when a user is deleted
CREATE OR REPLACE FUNCTION storage.cleanup_user_files()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'user-uploads'
  AND (storage.foldername(name))[1] = OLD.id::text;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger for user cleanup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'cleanup_user_files_trigger'
  ) THEN
    CREATE TRIGGER cleanup_user_files_trigger
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION storage.cleanup_user_files();
    
    RAISE NOTICE 'Created user cleanup trigger';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user cleanup trigger: %', SQLERRM;
END
$$;
