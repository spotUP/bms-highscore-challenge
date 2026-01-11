import { useState, useEffect } from 'react';
import ScreenScraperAPI from '@/utils/screenScraperApi';

interface UseScreenScraperImageProps {
  gameName: string;
  platformName: string;
  enabled?: boolean;
}

interface UseScreenScraperImageReturn {
  imageUrl: string | null;
  isLoading: boolean;
  error: boolean;
}

// Configure ScreenScraper API (you'll need to provide real credentials)
// For demo purposes, we'll disable it and show placeholders
const screenScraper = import.meta.env.SCREENSCRAPER_DEV_ID ? new ScreenScraperAPI({
  devId: import.meta.env.SCREENSCRAPER_DEV_ID!,
  devPassword: import.meta.env.SCREENSCRAPER_DEV_PASSWORD!,
  softName: import.meta.env.SCREENSCRAPER_SOFT_NAME || 'RetroRanks',
  ssUser: import.meta.env.SCREENSCRAPER_USER,
  ssPassword: import.meta.env.SCREENSCRAPER_PASSWORD
}) : null;

/**
 * Hook to fetch game images from ScreenScraper API
 */
export function useScreenScraperImage({
  gameName,
  platformName,
  enabled = true
}: UseScreenScraperImageProps): UseScreenScraperImageReturn {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Skip if not enabled, no API client, or invalid params
    if (!enabled || !screenScraper || !gameName.trim()) {
      return;
    }

    let isCancelled = false;

    async function fetchImage() {
      setIsLoading(true);
      setError(false);

      try {
        const url = await screenScraper.getGameScreenshot(gameName, platformName);

        if (!isCancelled) {
          setImageUrl(url);
          setError(!url);
        }
      } catch (err) {
        console.error('ScreenScraper image fetch error:', err);
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

    // Add a small delay to avoid hammering the API
    const timeoutId = setTimeout(fetchImage, Math.random() * 1000 + 500);

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
export async function getScreenScraperImageUrl(
  gameName: string,
  platformName?: string
): Promise<string | null> {
  if (!screenScraper || !gameName.trim()) {
    return null;
  }

  try {
    return await screenScraper.getGameScreenshot(gameName, platformName);
  } catch (error) {
    console.error('ScreenScraper API error:', error);
    return null;
  }
}