import { supabase } from '@/integrations/supabase/client';

/**
 * Create a short-lived signed URL for a private storage object.
 * @param bucket The bucket id, e.g. 'user-uploads'
 * @param path The full object path inside the bucket, e.g. `${userId}/file.png`
 * @param expiresIn Seconds until expiry (default 300s = 5 minutes)
 */
export async function getSignedUrl(bucket: string, path: string, expiresIn = 300) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

/**
 * Download a private storage object as a Blob using authenticated session.
 */
export async function downloadObject(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return data as Blob;
}

/**
 * Parse a Supabase Storage object URL into { bucket, path }.
 * Supports forms like:
 *  - https://<proj>.supabase.co/storage/v1/object/<bucket>/<path>
 *  - https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path> (returns bucket, path)
 *  - '<bucket>/<path>' (already bucket/path)
 */
export function parseStorageObjectUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  try {
    // If it's already in the form bucket/path
    if (!url.startsWith('http') && url.includes('/')) {
      const [bucket, ...rest] = url.split('/');
      return bucket && rest.length ? { bucket, path: rest.join('/') } : null;
    }
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    // expect ... /storage/v1/object/(public)?/<bucket>/<path...>
    const objectIdx = parts.indexOf('object');
    if (objectIdx === -1) return null;
    let idx = objectIdx + 1;
    if (parts[idx] === 'public') idx += 1; // skip optional 'public'
    const bucket = parts[idx];
    const path = parts.slice(idx + 1).join('/');
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}
