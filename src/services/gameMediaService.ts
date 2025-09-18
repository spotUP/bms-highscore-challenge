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
        `https://api.rawg.io/api/games/${gameSlug}/screenshots?key=${this.rawgApiKey}`
      );

      if (!response.ok) return [];

      const data = await response.json();

      return data.results?.map((screenshot: any, index: number) => ({
        id: `rawg-${screenshot.id || index}`,
        url: screenshot.image,
        thumbnailUrl: screenshot.image, // RAWG doesn't provide separate thumbnails
        source: 'rawg' as const,
        width: screenshot.width,
        height: screenshot.height
      })) || [];

    } catch (error) {
      console.error('RAWG screenshots error:', error);
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
        `https://api.rawg.io/api/games/${gameSlug}/movies?key=${this.rawgApiKey}`
      );

      if (!response.ok) return [];

      const data = await response.json();

      return data.results?.map((video: any, index: number) => ({
        id: `rawg-video-${video.id || index}`,
        url: video.data?.max || video.data?.['480'] || '',
        thumbnailUrl: video.preview,
        source: 'rawg' as const,
        type: 'trailer' as const,
        title: video.name
      })).filter((video: GameVideo) => video.url) || [];

    } catch (error) {
      console.error('RAWG videos error:', error);
      return [];
    }
  }

  /**
   * Fetch screenshots from IGDB API
   */
  async fetchIGDBScreenshots(gameId: number): Promise<GameScreenshot[]> {
    if (!this.igdbClientId || !this.igdbAccessToken) return [];

    try {
      const response = await fetch('https://api.igdb.com/v4/screenshots', {
        method: 'POST',
        headers: {
          'Client-ID': this.igdbClientId,
          'Authorization': `Bearer ${this.igdbAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: `where game = ${gameId}; fields url,width,height; limit 20;`
      });

      if (!response.ok) return [];

      const data = await response.json();

      return data.map((screenshot: any, index: number) => ({
        id: `igdb-${screenshot.id || index}`,
        url: `https:${screenshot.url?.replace('t_thumb', 't_1080p')}`, // Get high-res version
        thumbnailUrl: `https:${screenshot.url}`, // Thumbnail version
        source: 'igdb' as const,
        width: screenshot.width,
        height: screenshot.height
      }));

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
      const response = await fetch('https://api.igdb.com/v4/game_videos', {
        method: 'POST',
        headers: {
          'Client-ID': this.igdbClientId,
          'Authorization': `Bearer ${this.igdbAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: `where game = ${gameId}; fields name,video_id; limit 10;`
      });

      if (!response.ok) return [];

      const data = await response.json();

      return data.map((video: any, index: number) => ({
        id: `igdb-video-${video.video_id || index}`,
        url: `https://www.youtube.com/watch?v=${video.video_id}`,
        thumbnailUrl: `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`,
        source: 'igdb' as const,
        type: 'trailer' as const,
        title: video.name,
        embedId: video.video_id
      }));

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
          `https://api.rawg.io/api/games?key=${this.rawgApiKey}&search=${searchQuery}&page_size=1`
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
      }
    }

    // Get IGDB game ID
    if (this.igdbClientId && this.igdbAccessToken) {
      try {
        const response = await fetch('https://api.igdb.com/v4/games', {
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
    console.log(`🎮 GameMediaService: Fetching media for "${gameName}" (${platform})`);

    // Check cache first
    if (this.mediaCache.has(cacheKey)) {
      console.log(`📦 GameMediaService: Cache hit for "${gameName}"`);
      return this.mediaCache.get(cacheKey)!;
    }

    const screenshots: GameScreenshot[] = [];
    const videos: GameVideo[] = [];
    const logos: string[] = [];
    const backgroundImages: string[] = [];

    // Only use LaunchBox for logos, skip screenshots and videos (use RAWG instead)
    console.log(`🎯 GameMediaService: Skipping LaunchBox media, prioritizing RAWG for screenshots and videos`);

    if (existingMedia?.logo_url) {
      console.log(`🏷️ GameMediaService: Adding logo from LaunchBox - ${existingMedia.logo_url}`);
      logos.push(existingMedia.logo_url);
    }

    // Get identifiers for external APIs
    const identifiers = await this.getGameIdentifiers(gameName);

    // Fetch from RAWG (primary source for screenshots and videos)
    if (identifiers.rawgSlug) {
      console.log(`🎮 GameMediaService: Fetching primary content from RAWG for "${gameName}"`);
      const [rawgScreenshots, rawgVideos] = await Promise.allSettled([
        this.fetchRAWGScreenshots(identifiers.rawgSlug),
        this.fetchRAWGVideos(identifiers.rawgSlug)
      ]);

      if (rawgScreenshots.status === 'fulfilled') {
        console.log(`📸 GameMediaService: Added ${rawgScreenshots.value.length} screenshots from RAWG`);
        screenshots.push(...rawgScreenshots.value);
      }

      if (rawgVideos.status === 'fulfilled') {
        console.log(`🎥 GameMediaService: Added ${rawgVideos.value.length} videos from RAWG`);
        videos.push(...rawgVideos.value);
      }
    }

    // Fetch from IGDB
    if (identifiers.igdbId) {
      const [igdbScreenshots, igdbVideos] = await Promise.allSettled([
        this.fetchIGDBScreenshots(identifiers.igdbId),
        this.fetchIGDBVideos(identifiers.igdbId)
      ]);

      if (igdbScreenshots.status === 'fulfilled') {
        screenshots.push(...igdbScreenshots.value);
      }

      if (igdbVideos.status === 'fulfilled') {
        videos.push(...igdbVideos.value);
      }
    }

    // Remove duplicates and sort by source preference
    const uniqueScreenshots = this.deduplicateScreenshots(screenshots);
    const uniqueVideos = this.deduplicateVideos(videos);

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

    console.log(`✅ GameMediaService: Returning media for "${gameName}":`, {
      screenshots: gameMedia.screenshots.length,
      videos: gameMedia.videos.length,
      total: gameMedia.totalMediaCount
    });

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