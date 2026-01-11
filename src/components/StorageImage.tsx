import React from 'react';
import { getSignedUrl } from '@/lib/storage';

interface StorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  bucket: string;
  path: string; // object path inside bucket
  expiresIn?: number; // seconds, default 300
  refreshBeforeExpirySeconds?: number; // refresh a bit before expiry, default 30
  fallbackSrc?: string; // optional fallback when image fails
}

/**
 * StorageImage renders a short-lived signed URL for a private Storage object,
 * and periodically refreshes it before expiry so the image remains visible.
 */
const StorageImage: React.FC<StorageImageProps> = ({
  bucket,
  path,
  expiresIn = 300,
  refreshBeforeExpirySeconds = 30,
  fallbackSrc,
  alt,
  ...imgProps
}) => {
  const [src, setSrc] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setError(null);
      const url = await getSignedUrl(bucket, path, expiresIn);
      setSrc(url);
    } catch (e: any) {
      setError(e?.message || String(e));
      setSrc(null);
    }
  }, [bucket, path, expiresIn]);

  React.useEffect(() => {
    let timer: number | undefined;
    let mounted = true;

    (async () => {
      await refresh();
      if (!mounted) return;
      // Schedule a refresh shortly before expiry
      const refreshMs = Math.max(5, expiresIn - refreshBeforeExpirySeconds) * 1000;
      timer = window.setInterval(() => {
        refresh().catch(() => {});
      }, refreshMs);
    })();

    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [refresh, expiresIn, refreshBeforeExpirySeconds]);

  if (!src && fallbackSrc) {
    return <img src={fallbackSrc} alt={alt} {...imgProps} />;
  }

  if (!src && error) {
    // Render a lightweight placeholder on error
    return (
      <div
        aria-label={alt}
        {...(imgProps as any)}
        style={{
          width: (imgProps as any)?.width || 80,
          height: (imgProps as any)?.height || 80,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#aaa',
          fontSize: 12,
          ...((imgProps as any)?.style || {}),
        }}
      >
        image unavailable
      </div>
    );
  }

  return <img src={src ?? undefined} alt={alt} {...imgProps} onError={() => setError('failed to load')} />;
};

export default StorageImage;
