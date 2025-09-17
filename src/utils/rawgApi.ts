// RAWG Video Games Database API client for fetching game images and metadata

export interface RAWGConfig {
  apiKey: string;
}

export interface RAWGGameImage {
  id: number;
  image: string;
  width: number;
  height: number;
  is_deleted: boolean;
}

export interface RAWGGame {
  id: number;
  name: string;
  slug: string;
  background_image: string | null;
  released: string | null;
  rating: number;
  rating_top: number;
  ratings_count: number;
  metacritic: number | null;
  description?: string;
  description_raw?: string;
  website?: string;
  playtime?: number;
  esrb_rating?: {
    id: number;
    name: string;
    slug: string;
  };
  platforms: Array<{
    platform: {
      id: number;
      name: string;
      slug: string;
    };
    released_at?: string;
    requirements?: {
      minimum?: string;
      recommended?: string;
    };
  }>;
  genres: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  developers: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  publishers: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  stores?: Array<{
    id: number;
    store: {
      id: number;
      name: string;
      slug: string;
      domain: string;
    };
    url: string;
  }>;
  tags?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  short_screenshots: Array<{
    id: number;
    image: string;
  }>;
}

export interface RAWGSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RAWGGame[];
}

class RAWGAPI {
  private config: RAWGConfig;
  private baseUrl = 'https://api.rawg.io/api';

  constructor(config: RAWGConfig) {
    this.config = config;
  }

  /**
   * Build URL with API key parameter
   */
  private buildUrl(endpoint: string, params: URLSearchParams = new URLSearchParams()): string {
    params.append('key', this.config.apiKey);
    return `${this.baseUrl}${endpoint}?${params.toString()}`;
  }

  /**
   * Search for games by name
   */
  async searchGames(
    query: string,
    options: {
      platforms?: string[];
      genres?: string;
      tags?: string;
      dates?: string;
      metacritic?: string;
      ordering?: string;
      pageSize?: number;
      page?: number;
    } = {}
  ): Promise<RAWGSearchResponse> {
    const params = new URLSearchParams();

    if (query) {
      params.append('search', query);
    }

    if (options.platforms?.length) {
      params.append('platforms', options.platforms.join(','));
    }

    if (options.genres) {
      params.append('genres', options.genres);
    }

    if (options.tags) {
      params.append('tags', options.tags);
    }

    if (options.dates) {
      params.append('dates', options.dates);
    }

    if (options.metacritic) {
      params.append('metacritic', options.metacritic);
    }

    if (options.ordering) {
      params.append('ordering', options.ordering);
    }

    if (options.pageSize) {
      params.append('page_size', options.pageSize.toString());
    }

    if (options.page) {
      params.append('page', options.page.toString());
    }

    try {
      const response = await fetch(this.buildUrl('/games', params));

      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('RAWG search error:', error);
      throw error;
    }
  }

  /**
   * Get detailed game information by ID
   */
  async getGame(gameId: number): Promise<RAWGGame> {
    try {
      const response = await fetch(this.buildUrl(`/games/${gameId}`));

      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('RAWG getGame error:', error);
      throw error;
    }
  }

  /**
   * Get game screenshots by game ID
   */
  async getGameScreenshots(gameId: number): Promise<RAWGGameImage[]> {
    try {
      const response = await fetch(this.buildUrl(`/games/${gameId}/screenshots`));

      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('RAWG getGameScreenshots error:', error);
      return [];
    }
  }

  /**
   * Map platform names to RAWG platform IDs
   */
  private mapPlatformToRAWGId(platformName: string): number | null {
    const platformMap: Record<string, number> = {
      // PC
      'PC': 4,
      'Windows': 4,
      'DOS': 4,
      'MS-DOS': 4,

      // Nintendo
      'Nintendo Entertainment System': 49,
      'NES': 49,
      'Famicom': 49,
      'Super Nintendo Entertainment System': 83,
      'SNES': 83,
      'Super Famicom': 83,
      'Nintendo 64': 7,
      'N64': 7,
      'GameCube': 105,
      'Nintendo GameCube': 105,
      'Wii': 11,
      'Nintendo Wii': 11,
      'Wii U': 10,
      'Nintendo Wii U': 10,
      'Nintendo Switch': 7,
      'Switch': 7,
      'Game Boy': 26,
      'Nintendo Game Boy': 26,
      'Game Boy Color': 11,
      'Nintendo Game Boy Color': 11,
      'Game Boy Advance': 12,
      'Nintendo Game Boy Advance': 12,
      'GBA': 12,
      'Nintendo DS': 20,
      'DS': 20,
      'Nintendo 3DS': 8,
      '3DS': 8,

      // Sony
      'PlayStation': 27,
      'Sony PlayStation': 27,
      'PSX': 27,
      'PlayStation 2': 15,
      'Sony PlayStation 2': 15,
      'PS2': 15,
      'PlayStation 3': 16,
      'Sony PlayStation 3': 16,
      'PS3': 16,
      'PlayStation 4': 18,
      'Sony PlayStation 4': 18,
      'PS4': 18,
      'PlayStation 5': 187,
      'Sony PlayStation 5': 187,
      'PS5': 187,
      'PlayStation Portable': 17,
      'Sony PlayStation Portable': 17,
      'PSP': 17,
      'PlayStation Vita': 19,
      'Sony PlayStation Vita': 19,
      'PS Vita': 19,

      // Microsoft
      'Xbox': 80,
      'Microsoft Xbox': 80,
      'Xbox 360': 14,
      'Microsoft Xbox 360': 14,
      'Xbox One': 1,
      'Microsoft Xbox One': 1,
      'Xbox Series S/X': 186,
      'Xbox Series X': 186,
      'Xbox Series S': 186,

      // Sega
      'Sega Genesis': 167,
      'Genesis': 167,
      'Sega Mega Drive': 167,
      'Mega Drive': 167,
      'Sega Master System': 107,
      'Master System': 107,
      'Sega Saturn': 23,
      'Saturn': 23,
      'Sega Dreamcast': 106,
      'Dreamcast': 106,
      'Sega Game Gear': 77,
      'Game Gear': 77,
      'Sega 32X': 167, // Map to Genesis for now
      'Sega CD': 167, // Map to Genesis for now

      // Atari
      'Arcade': 79,
      'Atari 2600': 28,
      'Atari': 28,
      'Atari 5200': 25,
      'Atari 7800': 25,
      'Atari Lynx': 46,
      'Lynx': 46,
      'Atari Jaguar': 28,
      'Jaguar': 28,

      // Other Retro
      'Neo Geo': 12,
      'SNK Neo Geo': 12,
      'TurboGrafx-16': 112,
      'PC Engine': 112,
      'TurboGrafx-CD': 112,
      '3DO Interactive Multiplayer': 111,
      '3DO': 111,
      'ColecoVision': 28,
      'Intellivision': 28,
      'Vectrex': 28,
      'Commodore 64': 166,
      'C64': 166,
      'Commodore Amiga': 166,
      'Amiga': 166,
      'Apple II': 75,
      'Amstrad CPC': 166,
      'ZX Spectrum': 26,

      // Mobile
      'Android': 21,
      'iOS': 3,
      'iPhone': 3,
      'iPad': 3,
    };

    return platformMap[platformName] || null;
  }

  /**
   * Normalize game name for better matching
   */
  private normalizeGameName(name: string): string {
    return name
      .toLowerCase()
      // Remove trademark symbols
      .replace(/[™®©]/g, '')
      // Remove parentheses content (region codes, revisions, etc.)
      .replace(/\s*\([^)]*\)/g, '')
      // Remove bracket content ([!], [h1], etc.)
      .replace(/\s*\[[^\]]*\]/g, '')
      // Remove curly brace content
      .replace(/\s*\{[^}]*\}/g, '')
      // Remove common ROM suffixes
      .replace(/\s*-\s*(usa?|europe?|japan|world|rev\s*\w*|v\d+|\d+\.\d+)$/i, '')
      // Remove version numbers at the end
      .replace(/\s+v?\d+(\.\d+)*$/i, '')
      // Remove "the" from beginning for better matching
      .replace(/^the\s+/i, '')
      // Remove common subtitle separators and everything after
      .replace(/\s*[-:]\s*.*/g, '')
      // Replace special chars with spaces
      .replace(/[^\w\s]/g, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity score between two game names
   */
  private calculateSimilarity(name1: string, name2: string): number {
    const norm1 = this.normalizeGameName(name1);
    const norm2 = this.normalizeGameName(name2);

    // Exact match gets highest score
    if (norm1 === norm2) return 1.0;

    // Check if one contains the other (high score for partial matches)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const longer = norm1.length > norm2.length ? norm1 : norm2;
      const shorter = norm1.length > norm2.length ? norm2 : norm1;
      // Score based on how much of the longer string is covered
      return 0.7 + (shorter.length / longer.length) * 0.2;
    }

    // Word-based similarity with smart weighting
    const words1 = norm1.split(' ').filter(w => w.length > 1);
    const words2 = norm2.split(' ').filter(w => w.length > 1);

    if (words1.length === 0 || words2.length === 0) return 0;

    // Find common words
    const commonWords = words1.filter(w => words2.includes(w));

    // No common words = very low score
    if (commonWords.length === 0) return 0.1;

    // Calculate base similarity
    const baseSimilarity = (commonWords.length * 2) / (words1.length + words2.length);

    // Bonus for matching the first word (usually the main title)
    const firstWordBonus = words1[0] === words2[0] ? 0.2 : 0;

    // Bonus for matching most important words (longer words are usually more significant)
    const importantWordBonus = commonWords
      .filter(w => w.length > 3)
      .length * 0.1;

    return Math.min(1.0, baseSimilarity + firstWordBonus + importantWordBonus);
  }

  /**
   * Find the best matching game for a given name and platform
   */
  async findGame(gameName: string, platformName?: string): Promise<RAWGGame | null> {
    try {
      const platformIds = platformName ? [this.mapPlatformToRAWGId(platformName)].filter(Boolean).map(String) : undefined;
      const normalizedName = this.normalizeGameName(gameName);

      const searchQueries = [
        gameName,           // Original name
        normalizedName,     // Cleaned name
        // Try just the first few words for complex titles
        normalizedName.split(' ').slice(0, 3).join(' ')
      ].filter((query, index, arr) => query && query.length > 2 && arr.indexOf(query) === index);

      let allResults: RAWGGame[] = [];

      // Try each search query
      for (const query of searchQueries) {
        try {
          const searchResult = await this.searchGames(query, {
            platforms: platformIds as string[],
            pageSize: 5
          });

          allResults = [...allResults, ...searchResult.results];
        } catch (searchError) {
          console.warn(`RAWG search failed for "${query}":`, searchError);
        }
      }

      if (!allResults.length) {
        return null;
      }

      // Remove duplicates by ID
      const uniqueResults = allResults.filter((game, index, arr) =>
        arr.findIndex(g => g.id === game.id) === index
      );

      // Score and rank results by similarity
      const scoredResults = uniqueResults.map(game => ({
        game,
        score: this.calculateSimilarity(gameName, game.name)
      }));

      // Sort by score descending
      scoredResults.sort((a, b) => b.score - a.score);

      // Return best match if score is reasonable
      const bestMatch = scoredResults[0];

      // Use a higher threshold for better matching
      if (bestMatch.score > 0.5) {
        return bestMatch.game;
      }

      return null;
    } catch (error) {
      console.error('RAWG findGame error:', error);
      return null;
    }
  }

  /**
   * Get the best screenshot URL for a game
   */
  async getGameImage(gameName: string, platformName?: string): Promise<string | null> {
    try {
      const game = await this.findGame(gameName, platformName);

      if (!game) {
        return null;
      }

      // Try background image first
      if (game.background_image) {
        return game.background_image;
      }

      // Try short screenshots
      if (game.short_screenshots?.length > 0) {
        return game.short_screenshots[0].image;
      }

      // Try fetching additional screenshots
      const screenshots = await this.getGameScreenshots(game.id);
      if (screenshots.length > 0) {
        return screenshots[0].image;
      }

      return null;
    } catch (error) {
      console.error('RAWG getGameImage error:', error);
      return null;
    }
  }
}

export default RAWGAPI;