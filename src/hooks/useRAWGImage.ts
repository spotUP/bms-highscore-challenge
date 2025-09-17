import { useState, useEffect } from 'react';
import RAWGAPI from '@/utils/rawgApi';

interface UseRAWGImageProps {
  gameName: string;
  platformName?: string;
  enabled?: boolean;
}

interface UseRAWGImageReturn {
  imageUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

// Initialize RAWG API client
// The API key can be obtained for free at https://rawg.io/apidocs
const rawgApi = import.meta.env.VITE_RAWG_API_KEY && import.meta.env.VITE_RAWG_API_KEY !== 'your-rawg-api-key' && import.meta.env.VITE_RAWG_API_KEY !== 'test-key-get-your-own-from-rawg-io' ? new RAWGAPI({
  apiKey: import.meta.env.VITE_RAWG_API_KEY
}) : null;

/**
 * Hook to fetch game images from RAWG Video Games Database
 */
export function useRAWGImage({
  gameName,
  platformName,
  enabled = true
}: UseRAWGImageProps): UseRAWGImageReturn {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Skip if not enabled, no API client, or invalid params
    if (!enabled || !rawgApi || !gameName.trim()) {
      return;
    }

    let isCancelled = false;

    async function fetchImage() {
      setIsLoading(true);
      setError(false);

      try {
        const url = await rawgApi.getGameImage(gameName, platformName);

        if (!isCancelled) {
          setImageUrl(url);
          setError(!url);
        }
      } catch (err) {
        console.error('RAWG image fetch error:', err);
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

    // Add a random delay to avoid hitting rate limits
    const delay = Math.random() * 2000 + 500; // 500-2500ms delay
    const timeoutId = setTimeout(fetchImage, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [gameName, platformName, enabled]);

  return {
    imageUrl,
    isLoading,
    error
  };
}

/**
 * Simple function to get image URL without React hook (for server-side usage)
 */
export async function getRAWGImageUrl(
  gameName: string,
  platformName?: string
): Promise<string | null> {
  if (!rawgApi || !gameName.trim()) {
    return null;
  }

  try {
    return await rawgApi.getGameImage(gameName, platformName);
  } catch (error) {
    console.error('RAWG API error:', error);
    return null;
  }
}

/**
 * Check if RAWG API is configured
 */
export function isRAWGConfigured(): boolean {
  return !!rawgApi;
}