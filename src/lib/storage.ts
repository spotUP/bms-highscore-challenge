const API_URL = (import.meta as any)?.env?.VITE_API_URL || '';

/**
 * Create a short-lived signed URL for a private storage object.
 * @param bucket The bucket id, e.g. 'user-uploads'
 * @param path The full object path inside the bucket, e.g. `${userId}/file.png`
 * @param expiresIn Seconds until expiry (default 300s = 5 minutes)
 */
export async function getSignedUrl(bucket: string, path: string, expiresIn = 300) {
  const response = await fetch(`${API_URL}/api/storage/signed-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path, expiresIn })
  });
  if (!response.ok) {
    throw new Error(`Failed to create signed URL (${response.status})`);
  }
  const data = await response.json();
  return data?.signedUrl || null;
}

/**
 * Download a private storage object as a Blob using authenticated session.
 */
export async function downloadObject(bucket: string, path: string) {
  const response = await fetch(`${API_URL}/api/storage/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path })
  });
  if (!response.ok) {
    throw new Error(`Failed to download object (${response.status})`);
  }
  return await response.blob();
}

/**
 * Parse a storage object URL into { bucket, path }.
 * Supports forms like:
 *  - https://<api>/media/<bucket>/<path>
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
    const mediaIdx = parts.indexOf('media');
    if (mediaIdx === -1) return null;
    const bucket = parts[mediaIdx + 1];
    const path = parts.slice(mediaIdx + 2).join('/');
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}
