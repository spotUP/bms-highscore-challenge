import RAWGAPI, { RAWGGame, RAWGSearchResponse } from '@/utils/rawgApi';

export interface GameSearchFilters {
  search?: string;
  platforms?: string[];
  genres?: string[];
  tags?: string[];
  yearRange?: [number, number];
  minRating?: number;
  esrbRating?: string;
  page?: number;
  pageSize?: number;
}

export interface PlatformInfo {
  id: number;
  name: string;
  slug: string;
}

export interface GenreInfo {
  id: number;
  name: string;
  slug: string;
}

class RAWGGamesService {
  private api: RAWGAPI | null = null;

  constructor() {
    const apiKey = import.meta.env.VITE_RAWG_API_KEY;
    if (apiKey && apiKey !== 'your-rawg-api-key' && apiKey !== 'test-key-get-your-own-from-rawg-io') {
      this.api = new RAWGAPI({ apiKey });
    }
  }

  isConfigured(): boolean {
    return !!this.api;
  }

  async searchGames(filters: GameSearchFilters = {}): Promise<{
    games: RAWGGame[];
    totalCount: number;
    hasNextPage: boolean;
  }> {
    if (!this.api) {
      throw new Error('RAWG API not configured');
    }

    const {
      search = '',
      platforms = [],
      genres = [],
      tags = [],
      yearRange,
      minRating,
      page = 1,
      pageSize = 24
    } = filters;

    try {
      const searchParams: any = {
        pageSize,
        page
      };

      if (platforms.length > 0) {
        searchParams.platforms = platforms;
      }

      if (genres.length > 0) {
        searchParams.genres = genres.join(',');
      }

      if (tags.length > 0) {
        searchParams.tags = tags.join(',');
      }

      if (yearRange) {
        searchParams.dates = `${yearRange[0]}-01-01,${yearRange[1]}-12-31`;
      }

      if (minRating) {
        searchParams.metacritic = `${Math.round(minRating * 20)},100`; // Convert 1-5 to 20-100
      }

      const response = await this.api.searchGames(search, searchParams);

      return {
        games: response.results,
        totalCount: response.count,
        hasNextPage: !!response.next
      };
    } catch (error) {
      console.error('RAWG search error:', error);
      return {
        games: [],
        totalCount: 0,
        hasNextPage: false
      };
    }
  }

  async getPopularGames(page: number = 1, pageSize: number = 24): Promise<{
    games: RAWGGame[];
    totalCount: number;
    hasNextPage: boolean;
  }> {
    if (!this.api) {
      throw new Error('RAWG API not configured');
    }

    try {
      const response = await this.api.searchGames('', {
        page,
        pageSize,
        ordering: '-rating'
      });

      return {
        games: response.results,
        totalCount: response.count,
        hasNextPage: !!response.next
      };
    } catch (error) {
      console.error('RAWG popular games error:', error);
      return {
        games: [],
        totalCount: 0,
        hasNextPage: false
      };
    }
  }

  async getPlatforms(): Promise<PlatformInfo[]> {
    // For now, return common platforms. In a full implementation,
    // we could fetch these from RAWG's platforms endpoint
    return [
      { id: 4, name: 'PC', slug: 'pc' },
      { id: 187, name: 'PlayStation 5', slug: 'playstation5' },
      { id: 18, name: 'PlayStation 4', slug: 'playstation4' },
      { id: 1, name: 'Xbox One', slug: 'xbox-one' },
      { id: 186, name: 'Xbox Series S/X', slug: 'xbox-series-x' },
      { id: 7, name: 'Nintendo Switch', slug: 'nintendo-switch' },
      { id: 49, name: 'NES', slug: 'nes' },
      { id: 83, name: 'SNES', slug: 'snes' },
      { id: 167, name: 'Genesis', slug: 'genesis' },
      { id: 27, name: 'PlayStation', slug: 'playstation' },
      { id: 15, name: 'PlayStation 2', slug: 'playstation2' },
      { id: 16, name: 'PlayStation 3', slug: 'playstation3' },
      { id: 80, name: 'Xbox', slug: 'xbox' },
      { id: 14, name: 'Xbox 360', slug: 'xbox360' },
      { id: 105, name: 'GameCube', slug: 'gamecube' },
      { id: 106, name: 'Dreamcast', slug: 'dreamcast' },
      { id: 79, name: 'Arcade', slug: 'arcade' }
    ];
  }

  async getGenres(): Promise<GenreInfo[]> {
    // For now, return common genres. In a full implementation,
    // we could fetch these from RAWG's genres endpoint
    return [
      { id: 4, name: 'Action', slug: 'action' },
      { id: 51, name: 'Indie', slug: 'indie' },
      { id: 3, name: 'Adventure', slug: 'adventure' },
      { id: 5, name: 'RPG', slug: 'role-playing-games-rpg' },
      { id: 10, name: 'Strategy', slug: 'strategy' },
      { id: 2, name: 'Shooter', slug: 'shooter' },
      { id: 40, name: 'Casual', slug: 'casual' },
      { id: 14, name: 'Simulation', slug: 'simulation' },
      { id: 7, name: 'Puzzle', slug: 'puzzle' },
      { id: 11, name: 'Arcade', slug: 'arcade' },
      { id: 83, name: 'Platformer', slug: 'platformer' },
      { id: 1, name: 'Racing', slug: 'racing' },
      { id: 15, name: 'Sports', slug: 'sports' },
      { id: 6, name: 'Fighting', slug: 'fighting' },
      { id: 19, name: 'Family', slug: 'family' },
      { id: 28, name: 'Board Games', slug: 'board-games' },
      { id: 34, name: 'Educational', slug: 'educational' },
      { id: 17, name: 'Card', slug: 'card' }
    ];
  }

  getGameImage(game: RAWGGame): string | null {
    // Try different image sources in order of preference
    if (game.background_image) {
      return game.background_image;
    }

    if (game.short_screenshots && game.short_screenshots.length > 0) {
      return game.short_screenshots[0].image;
    }

    return null;
  }
}

export const rawgGamesService = new RAWGGamesService();