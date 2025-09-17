import { useState, useEffect } from 'react';
import { getGameScreenshot } from '@/utils/launchboxImages';

interface UseLaunchboxImageProps {
  databaseId?: number | null;
  gameName: string;
  platformName: string;
  enabled?: boolean;
}

interface UseLaunchboxImageReturn {
  imageUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

/**
 * Hook to dynamically fetch game images from LaunchBox Games Database
 */
export function useLaunchboxImage({
  databaseId,
  gameName,
  platformName,
  enabled = true
}: UseLaunchboxImageProps): UseLaunchboxImageReturn {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Skip if not enabled or no database ID
    if (!enabled || !databaseId) {
      return;
    }

    let isCancelled = false;

    async function fetchImage() {
      setIsLoading(true);
      setError(false);

      try {
        const url = await getGameScreenshot(databaseId, gameName, platformName);

        if (!isCancelled) {
          setImageUrl(url);
          setError(!url);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(true);
          setImageUrl(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchImage();

    return () => {
      isCancelled = true;
    };
  }, [databaseId, gameName, platformName, enabled]);

  return {
    imageUrl,
    isLoading,
    error
  };
}