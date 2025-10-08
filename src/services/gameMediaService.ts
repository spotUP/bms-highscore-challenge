// Game Media Aggregation Service - Screenshots, Videos, Trailers
// Combines media from LaunchBox, RAWG, IGDB, and YouTube

export interface GameScreenshot {
  id: string;
  url: string;
  thumbnailUrl?: string;
  source: 'launchbox' | 'rawg' | 'igdb' | 'manual';
  width?: number;
  height?: number;
  caption?: string;
}

export interface GameVideo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  source: 'launchbox' | 'rawg' | 'igdb' | 'youtube';
  type: 'trailer' | 'gameplay' | 'review' | 'other';
  title?: string;
  duration?: number;
  embedId?: string; // For YouTube videos
}

export interface GameMedia {
  gameName: string;
  platform?: string;
  screenshots: GameScreenshot[];
  videos: GameVideo[];
  coverArt?: string;
  logos: string[];
  backgroundImages: string[];
  totalMediaCount: number;
}

class GameMediaService {
  private rawgApiKey?: string;
  private igdbClientId?: string;
  private igdbAccessToken?: string;

  // Cache to avoid repeated requests
  private mediaCache = new Map<string, GameMedia>();

  constructor() {
    this.rawgApiKey = import.meta.env.VITE_RAWG_API_KEY;
    this.igdbClientId = import.meta.env.VITE_IGDB_CLIENT_ID;
    this.igdbAccessToken = import.meta.env.VITE_IGDB_ACCESS_TOKEN;
  }

  /**
   * Convert RAWG image URL to proxy URL for CORS bypass
   */
  private proxyRAWGImageUrl(rawgUrl: string): string {
    if (!rawgUrl || !rawgUrl.includes('media.rawg.io')) {
      return rawgUrl;
    }

    // Extract the path after 'media.rawg.io/media/'
    const mediaMatch = rawgUrl.match(/media\.rawg\.io\/media\/(.+)/);
    if (mediaMatch) {
      return `http://localhost:3001/rawg-images/${mediaMatch[1]}`;
    }

    return rawgUrl;
  }

  /**
   * Convert IGDB image URL to proxy URL for CORS bypass
   */
  private proxyIGDBImageUrl(igdbUrl: string): string {
    if (!igdbUrl || !igdbUrl.includes('images.igdb.com')) {
      return igdbUrl;
    }

    // Extract the path after 'images.igdb.com/'
    const imageMatch = igdbUrl.match(/images\.igdb\.com\/(.+)/);
    if (imageMatch) {
      return `http://localhost:3001/igdb-images/${imageMatch[1]}`;
    }

    return igdbUrl;
  }

  /**
   * Extract YouTube video ID from various YouTube URL formats
   */
  private extractYouTubeId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;

    // Clean up the URL
    const cleanUrl = url.trim();

    const patterns = [
      // Standard youtube.com URLs
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
      // Shortened youtu.be URLs
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
      // Embed URLs
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      // Old-style URLs
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      // Mobile URLs
      /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
      // Any other v= parameter
      /[?&]v=([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1] && match[1].length === 11) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Fetch screenshots from RAWG API
   */
  async fetchRAWGScreenshots(gameSlug: string): Promise<GameScreenshot[]> {
    if (!this.rawgApiKey) return [];

    try {
      const response = await fetch(
        `http://localhost:3001/rawg-api/api/games/${gameSlug}/screenshots?key=${this.rawgApiKey}`
      );

      if (!response.ok) return [];

      const data = await response.json();

      return data.results?.map((screenshot: any, index: number) => ({
        id: `rawg-${screenshot.id || index}`,
        url: this.proxyRAWGImageUrl(screenshot.image),
        thumbnailUrl: this.proxyRAWGImageUrl(screenshot.image), // RAWG doesn't provide separate thumbnails
        source: 'rawg' as const,
        width: screenshot.width,
        height: screenshot.height
      })) || [];

    } catch (error) {
      console.error('RAWG screenshots error:', error);
      // Check if it's a rate limit error (429) or auth error (401)
      if (error instanceof Response && (error.status === 401 || error.status === 429)) {
        console.warn('RAWG API rate limited or auth failed - skipping RAWG screenshots');
      }
      return [];
    }
  }

  /**
   * Fetch game trailers/videos from RAWG API
   */
  async fetchRAWGVideos(gameSlug: string): Promise<GameVideo[]> {
    if (!this.rawgApiKey) return [];

    try {
      const response = await fetch(
        `http://localhost:3001/rawg-api/api/games/${gameSlug}/movies?key=${this.rawgApiKey}`
      );

      if (!response.ok) return [];

      const data = await response.json();

      return data.results?.map((video: any, index: number) => {
        const videoUrl = video.data?.max || video.data?.['480'] || '';
        const embedId = this.extractYouTubeId(videoUrl);

        return {
          id: `rawg-video-${video.id || index}`,
          url: videoUrl,
          thumbnailUrl: video.preview ? this.proxyRAWGImageUrl(video.preview) : (embedId ? `https://img.youtube.com/vi/${embedId}/hqdefault.jpg` : undefined),
          source: 'rawg' as const,
          type: 'trailer' as const,
          title: video.name,
          embedId
        };
      }).filter((video: GameVideo) => video.url) || [];

    } catch (error) {
      console.error('RAWG videos error:', error);
      // Check if it's a rate limit error (429) or auth error (401)
      if (error instanceof Response && (error.status === 401 || error.status === 429)) {
        console.warn('RAWG API rate limited or auth failed - skipping RAWG videos');
      }
      return [];
    }
  }

  /**
   * Fetch screenshots from IGDB API
   */
  async fetchIGDBScreenshots(gameId: number): Promise<GameScreenshot[]> {
    if (!this.igdbClientId || !this.igdbAccessToken) return [];

    try {
      const response = await fetch('http://localhost:3001/igdb-api/v4/screenshots', {
        method: 'POST',
        headers: {
          'Client-ID': this.igdbClientId,
          'Authorization': `Bearer ${this.igdbAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: `where game = ${gameId}; fields *; limit 20;`
      });

      if (!response.ok) return [];

      const data = await response.json();

      return data.map((screenshot: any, index: number) => {
        // IGDB should provide image_id field for URL construction
        // Format: https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg
        let fullUrl = null;
        let thumbnailUrl = null;

        if (screenshot.image_id) {
          // Construct full URLs using IGDB's image format
          const baseUrl = `https://images.igdb.com/igdb/image/upload`;
          fullUrl = this.proxyIGDBImageUrl(`${baseUrl}/t_1080p/${screenshot.image_id}.jpg`);
          thumbnailUrl = this.proxyIGDBImageUrl(`${baseUrl}/t_thumb/${screenshot.image_id}.jpg`);
        } else if (screenshot.url) {
          // Fallback: if url field exists, use it
          const normalizedUrl = screenshot.url.startsWith('//') ? `https:${screenshot.url}` : screenshot.url;
          fullUrl = this.proxyIGDBImageUrl(normalizedUrl.replace('t_thumb', 't_1080p'));
          thumbnailUrl = this.proxyIGDBImageUrl(normalizedUrl);
        }

        // Skip screenshots without valid URLs
        if (!fullUrl) {
          console.log('Skipping IGDB screenshot - no valid URL or image_id:', screenshot);
          return null;
        }

        return {
          id: `igdb-${screenshot.id || index}`,
          url: fullUrl,
          thumbnailUrl: thumbnailUrl,
          source: 'igdb' as const,
          width: screenshot.width,
          height: screenshot.height
        };
      }).filter((screenshot: any) => screenshot !== null);

    } catch (error) {
      console.error('IGDB screenshots error:', error);
      return [];
    }
  }

  /**
   * Fetch videos from IGDB API
   */
  async fetchIGDBVideos(gameId: number): Promise<GameVideo[]> {
    if (!this.igdbClientId || !this.igdbAccessToken) return [];

    try {
      const response = await fetch('http://localhost:3001/igdb-api/v4/game_videos', {
        method: 'POST',
        headers: {
          'Client-ID': this.igdbClientId,
          'Authorization': `Bearer ${this.igdbAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: `where game = ${gameId}; fields *; limit 10;`
      });

      if (!response.ok) return [];

      const data = await response.json();

      return data.map((video: any, index: number) => {
        // IGDB videos can be hosted on different platforms
        // Check if it's a YouTube video by looking for video_id and checking if it's a YouTube URL
        let embedId = null;
        let videoUrl = null;

        // If video has a URL field, try to extract YouTube ID from it
        if (video.url) {
          embedId = this.extractYouTubeId(video.url);
          videoUrl = video.url;
        }
        // Otherwise, assume video_id is a YouTube ID (legacy behavior)
        else if (video.video_id) {
          embedId = video.video_id;
          videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
        }

        // Skip non-YouTube videos for now
        if (!embedId || !videoUrl) {
          console.log('Skipping IGDB video - not YouTube:', video);
          return null;
        }

        return {
          id: `igdb-video-${embedId}`,
          url: videoUrl,
          thumbnailUrl: `https://img.youtube.com/vi/${embedId}/hqdefault.jpg`,
          source: 'igdb' as const,
          type: 'trailer' as const,
          title: video.name || video.title,
          embedId: embedId
        };
      }).filter((video: any) => video !== null);

    } catch (error) {
      console.error('IGDB videos error:', error);
      return [];
    }
  }

  /**
   * Search for game and get its ID/slug from both APIs
   */
  async getGameIdentifiers(gameName: string): Promise<{
    rawgSlug?: string;
    igdbId?: number;
    rawgId?: number;
  }> {
    const identifiers: any = {};

    // Get RAWG game slug
    if (this.rawgApiKey) {
      try {
        const searchQuery = encodeURIComponent(gameName);
        const response = await fetch(
          `http://localhost:3001/rawg-api/api/games?key=${this.rawgApiKey}&search=${searchQuery}&page_size=1`
        );

        if (response.ok) {
          const data = await response.json();
          const game = data.results?.[0];
          if (game) {
            identifiers.rawgSlug = game.slug;
            identifiers.rawgId = game.id;
          }
        }
      } catch (error) {
        console.error('RAWG search error:', error);
        // Check if it's a rate limit error (429) or auth error (401)
        if (error instanceof Response && (error.status === 401 || error.status === 429)) {
          console.warn('RAWG API rate limited or auth failed - skipping RAWG search');
        }
      }
    }

    // Get IGDB game ID
    if (this.igdbClientId && this.igdbAccessToken) {
      try {
        const response = await fetch('http://localhost:3001/igdb-api/v4/games', {
          method: 'POST',
          headers: {
            'Client-ID': this.igdbClientId,
            'Authorization': `Bearer ${this.igdbAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: `search "${gameName}"; fields id; limit 1;`
        });

        if (response.ok) {
          const data = await response.json();
          const game = data[0];
          if (game) {
            identifiers.igdbId = game.id;
          }
        }
      } catch (error) {
        console.error('IGDB search error:', error);
      }
    }

    return identifiers;
  }

  /**
   * Get comprehensive media for a game from all sources
   */
  async getGameMedia(
    gameName: string,
    platform?: string,
    existingMedia?: {
      screenshot_url?: string;
      cover_url?: string;
      logo_url?: string;
      video_url?: string;
    }
  ): Promise<GameMedia> {
    const cacheKey = `${gameName}-${platform || 'unknown'}`;

    // Check cache first
    if (this.mediaCache.has(cacheKey)) {
      return this.mediaCache.get(cacheKey)!;
    }

    const screenshots: GameScreenshot[] = [];
    const videos: GameVideo[] = [];
    const logos: string[] = [];
    const backgroundImages: string[] = [];

    if (existingMedia?.logo_url) {
      logos.push(existingMedia.logo_url);
    }

    // Add existing video from Supabase if available (prioritize first)
    if (existingMedia?.video_url) {
      const embedId = this.extractYouTubeId(existingMedia.video_url);
      videos.unshift({  // Use unshift to add at beginning
        id: 'supabase-video',
        url: existingMedia.video_url,
        thumbnailUrl: embedId ? `https://img.youtube.com/vi/${embedId}/hqdefault.jpg` : undefined,
        source: 'launchbox',
        type: 'trailer',
        title: `${gameName} Video`,
        embedId
      });
      console.log(`🎬 Added Supabase video for "${gameName}" (prioritized):`, existingMedia.video_url);
    }

    // Get identifiers for external APIs
    const identifiers = await this.getGameIdentifiers(gameName);
    console.log(`🔍 Game identifiers for "${gameName}":`, identifiers);

    // Try IGDB screenshots first (now requesting all fields)
    if (identifiers.igdbId) {
      const igdbScreenshots = await this.fetchIGDBScreenshots(identifiers.igdbId);
      screenshots.push(...igdbScreenshots);
      console.log(`🖼️ IGDB: Found ${igdbScreenshots.length} screenshots for "${gameName}"`);

      const igdbVideos = await this.fetchIGDBVideos(identifiers.igdbId);
      videos.push(...igdbVideos);
      console.log(`🎬 IGDB: Found ${igdbVideos.length} videos for "${gameName}"`);
    }

    // Only try RAWG as fallback if IGDB didn't provide screenshots
    if (identifiers.rawgSlug && screenshots.length === 0) {
      const rawgScreenshots = await this.fetchRAWGScreenshots(identifiers.rawgSlug);
      screenshots.push(...rawgScreenshots);
      console.log(`🖼️ RAWG: Found ${rawgScreenshots.length} screenshots for "${gameName}" (fallback)`);
    }

    // Remove duplicates and sort by source preference
    const uniqueScreenshots = this.deduplicateScreenshots(screenshots);
    const uniqueVideos = this.deduplicateVideos(videos);

    console.log(`📊 Final media count for "${gameName}": ${uniqueScreenshots.length} screenshots, ${uniqueVideos.length} videos (${uniqueVideos.map(v => v.source).join(', ')})`);

    const gameMedia: GameMedia = {
      gameName,
      platform,
      screenshots: uniqueScreenshots,
      videos: uniqueVideos,
      coverArt: existingMedia?.cover_url,
      logos,
      backgroundImages,
      totalMediaCount: uniqueScreenshots.length + uniqueVideos.length + logos.length
    };

    // Cache the result
    this.mediaCache.set(cacheKey, gameMedia);

    return gameMedia;
  }

  /**
   * Remove duplicate screenshots based on visual similarity (basic URL comparison)
   */
  private deduplicateScreenshots(screenshots: GameScreenshot[]): GameScreenshot[] {
    const seen = new Set<string>();
    const unique: GameScreenshot[] = [];

    for (const screenshot of screenshots) {
      // Simple deduplication based on URL similarity
      const urlKey = screenshot.url.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(urlKey)) {
        seen.add(urlKey);
        unique.push(screenshot);
      }
    }

    // Sort by source preference: launchbox > igdb > rawg
    return unique.sort((a, b) => {
      const sourceOrder = { launchbox: 0, igdb: 1, rawg: 2, manual: 3 };
      return sourceOrder[a.source] - sourceOrder[b.source];
    });
  }

  /**
   * Remove duplicate videos
   */
  private deduplicateVideos(videos: GameVideo[]): GameVideo[] {
    const seen = new Set<string>();
    const unique: GameVideo[] = [];

    for (const video of videos) {
      const key = video.embedId || video.url;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(video);
      }
    }

    // Sort by source preference and type
    return unique.sort((a, b) => {
      const sourceOrder = { launchbox: 0, igdb: 1, rawg: 2, youtube: 3 };
      const typeOrder = { trailer: 0, gameplay: 1, review: 2, other: 3 };

      const sourceCompare = sourceOrder[a.source] - sourceOrder[b.source];
      if (sourceCompare !== 0) return sourceCompare;

      return typeOrder[a.type] - typeOrder[b.type];
    });
  }

  /**
   * Clear cache (useful for development/testing)
   */
  clearCache(): void {
    this.mediaCache.clear();
  }
}

export const gameMediaService = new GameMediaService();