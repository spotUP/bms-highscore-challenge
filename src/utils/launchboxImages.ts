// Utility functions for fetching game images from LaunchBox Games Database

export interface GameImageUrls {
  screenshot?: string;
  boxFront?: string;
  boxBack?: string;
  clearLogo?: string;
  banner?: string;
}

// LaunchBox Games Database image CDN patterns
const LAUNCHBOX_IMAGES_BASE = 'https://images.launchbox-app.com';

/**
 * Generate possible image URLs for a game based on its LaunchBox database ID
 * These URLs follow common LaunchBox naming patterns
 */
export function getGameImageUrls(databaseId: number, gameName: string, platformName: string): GameImageUrls {
  const urls: GameImageUrls = {};

  // Common LaunchBox image naming patterns
  const cleanGameName = gameName
    .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase();

  const cleanPlatform = platformName
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

  // Try different common LaunchBox image URL patterns
  // Pattern 1: Direct database ID based URLs
  urls.screenshot = `${LAUNCHBOX_IMAGES_BASE}/games/${databaseId}-01.jpg`;
  urls.boxFront = `${LAUNCHBOX_IMAGES_BASE}/games/${databaseId}-02.jpg`;
  urls.clearLogo = `${LAUNCHBOX_IMAGES_BASE}/games/${databaseId}-03.png`;

  // Pattern 2: Platform-specific folders
  // urls.screenshot = `${LAUNCHBOX_IMAGES_BASE}/games/${cleanPlatform}/${cleanGameName}/screenshot.jpg`;
  // urls.boxFront = `${LAUNCHBOX_IMAGES_BASE}/games/${cleanPlatform}/${cleanGameName}/box-front.jpg`;

  return urls;
}

/**
 * Check if an image URL exists and is accessible
 */
export async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the first available image URL from a list of possible URLs
 */
export async function getFirstAvailableImage(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    if (await checkImageExists(url)) {
      return url;
    }
  }
  return null;
}

/**
 * Get the best available screenshot for a game
 * Tries multiple URL patterns and returns the first working one
 */
export async function getGameScreenshot(databaseId: number, gameName: string, platformName: string): Promise<string | null> {
  const imageUrls = getGameImageUrls(databaseId, gameName, platformName);

  const possibleUrls = [
    imageUrls.screenshot,
    imageUrls.boxFront,
    imageUrls.clearLogo
  ].filter(Boolean) as string[];

  return getFirstAvailableImage(possibleUrls);
}