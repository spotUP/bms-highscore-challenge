-- Remove legacy logo storage system
-- The legacy 'game-logos' bucket and its policies are no longer needed
-- since we now use the clear logo service exclusively

-- Drop storage policies for the game-logos bucket
DROP POLICY IF EXISTS "Allow public read access to game logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload game logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update game logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete game logos" ON storage.objects;

-- Delete all objects in the game-logos bucket (if any remain)
DELETE FROM storage.objects WHERE bucket_id = 'game-logos';

-- Remove the game-logos bucket
DELETE FROM storage.buckets WHERE id = 'game-logos';

-- Clean up any legacy logo URLs in the games table
-- Set legacy logo URLs to NULL so the clear logo service can handle them
UPDATE games
SET logo_url = NULL
WHERE logo_url LIKE '%/storage/v1/object/public/game-logos/%'
   OR logo_url LIKE '/game-logos/%'
   OR logo_url LIKE 'https://tnsgrwntmnzpaifmutqh.supabase.co/storage/v1/object/public/game-logos/%';

-- Note: logo_url column is kept as it will contain URLs from the clear logo service