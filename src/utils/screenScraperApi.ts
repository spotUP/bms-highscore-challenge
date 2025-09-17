// ScreenScraper.fr API client for fetching game images and metadata

export interface ScreenScraperConfig {
  devId: string; // Your developer ID
  devPassword: string; // Your developer password
  softName: string; // Your software name
  ssUser?: string; // ScreenScraper username (optional but recommended)
  ssPassword?: string; // ScreenScraper password (optional but recommended)
}

export interface GameImage {
  type: 'screenshot' | 'box2d' | 'box3d' | 'fanart' | 'logo' | 'wheel';
  url: string;
  region?: string;
}

export interface ScreenScraperGame {
  id: string;
  name: string;
  images: GameImage[];
  synopsis?: string;
  rating?: number;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  genre?: string[];
}

class ScreenScraperAPI {
  private config: ScreenScraperConfig;
  private baseUrl = 'https://www.screenscraper.fr/api2';

  constructor(config: ScreenScraperConfig) {
    this.config = config;
  }

  /**
   * Build the base API URL with authentication parameters
   */
  private buildBaseParams(): URLSearchParams {
    const params = new URLSearchParams({
      devid: this.config.devId,
      devpassword: this.config.devPassword,
      softname: this.config.softName,
      output: 'json'
    });

    if (this.config.ssUser && this.config.ssPassword) {
      params.append('ssuser', this.config.ssUser);
      params.append('sspassword', this.config.ssPassword);
    }

    return params;
  }

  /**
   * Search for a game by name and platform
   */
  async searchGame(gameName: string, platformName?: string): Promise<ScreenScraperGame[]> {
    const params = this.buildBaseParams();
    params.append('recherche', gameName);

    if (platformName) {
      // Map common platform names to ScreenScraper system IDs
      const platformId = this.mapPlatformToSystemId(platformName);
      if (platformId) {
        params.append('systemeid', platformId.toString());
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/jeuRecherche.php?${params}`);

      if (!response.ok) {
        throw new Error(`ScreenScraper API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseGameResults(data);
    } catch (error) {
      console.error('ScreenScraper search error:', error);
      return [];
    }
  }

  /**
   * Get game info by exact name and platform
   */
  async getGameByName(gameName: string, platformName?: string): Promise<ScreenScraperGame | null> {
    const params = this.buildBaseParams();
    params.append('romnom', gameName);

    if (platformName) {
      const platformId = this.mapPlatformToSystemId(platformName);
      if (platformId) {
        params.append('systemeid', platformId.toString());
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/jeuInfos.php?${params}`);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const games = this.parseGameResults(data);
      return games.length > 0 ? games[0] : null;
    } catch (error) {
      console.error('ScreenScraper getGameByName error:', error);
      return null;
    }
  }

  /**
   * Map platform names to ScreenScraper system IDs
   */
  private mapPlatformToSystemId(platformName: string): number | null {
    const platformMap: Record<string, number> = {
      'Arcade': 75,
      'Nintendo Entertainment System': 3,
      'Super Nintendo Entertainment System': 4,
      'Nintendo 64': 14,
      'GameCube': 13,
      'Wii': 16,
      'Wii U': 18,
      'Nintendo Switch': 225,
      'Game Boy': 9,
      'Game Boy Color': 10,
      'Game Boy Advance': 12,
      'Nintendo DS': 15,
      'Nintendo 3DS': 17,
      'Sega Genesis': 1,
      'Sega Master System': 2,
      'Sega Saturn': 22,
      'Sega Dreamcast': 23,
      'Sega Game Gear': 21,
      'PlayStation': 57,
      'PlayStation 2': 58,
      'PlayStation 3': 59,
      'PlayStation 4': 60,
      'PlayStation 5': 61,
      'PlayStation Portable': 61,
      'PlayStation Vita': 62,
      'Xbox': 32,
      'Xbox 360': 33,
      'Xbox One': 34,
      'Atari 2600': 26,
      'Atari 5200': 40,
      'Atari 7800': 41,
      'Atari Lynx': 28,
      'Neo Geo': 70,
      'Neo Geo Pocket': 25,
      'TurboGrafx-16': 31,
      'PC Engine': 31,
      '3DO Interactive Multiplayer': 29,
      'Commodore 64': 66,
      'Amiga': 64,
      'DOS': 135,
      'Windows': 138
    };

    return platformMap[platformName] || null;
  }

  /**
   * Parse ScreenScraper API response into our game format
   */
  private parseGameResults(data: any): ScreenScraperGame[] {
    if (!data || !data.response) {
      return [];
    }

    const games = data.response.jeux || [data.response.jeu];
    if (!Array.isArray(games)) {
      return games ? [this.parseGame(games)] : [];
    }

    return games.map((game: any) => this.parseGame(game));
  }

  /**
   * Parse individual game data
   */
  private parseGame(gameData: any): ScreenScraperGame {
    const images: GameImage[] = [];

    // Parse different image types
    if (gameData.medias) {
      for (const media of gameData.medias) {
        if (media.type === 'ss' || media.type === 'screenshot') {
          images.push({
            type: 'screenshot',
            url: media.url,
            region: media.region
          });
        } else if (media.type === 'box-2D' || media.type === 'boxart') {
          images.push({
            type: 'box2d',
            url: media.url,
            region: media.region
          });
        } else if (media.type === 'box-3D') {
          images.push({
            type: 'box3d',
            url: media.url,
            region: media.region
          });
        } else if (media.type === 'wheel' || media.type === 'logo') {
          images.push({
            type: 'wheel',
            url: media.url,
            region: media.region
          });
        }
      }
    }

    return {
      id: gameData.id?.toString() || '',
      name: gameData.nom || '',
      images,
      synopsis: gameData.synopsis?.[0]?.text,
      rating: gameData.note ? parseFloat(gameData.note) / 20 * 5 : undefined, // Convert from 0-20 to 0-5
      releaseDate: gameData.dates?.[0]?.text,
      developer: gameData.developpeur?.text,
      publisher: gameData.editeur?.text,
      genre: gameData.genres?.map((g: any) => g.text) || []
    };
  }

  /**
   * Get the best screenshot for a game
   */
  async getGameScreenshot(gameName: string, platformName?: string): Promise<string | null> {
    const game = await this.getGameByName(gameName, platformName);

    if (!game || !game.images.length) {
      return null;
    }

    // Prefer screenshots, then box art, then any image
    const screenshot = game.images.find(img => img.type === 'screenshot');
    const boxart = game.images.find(img => img.type === 'box2d');
    const anyImage = game.images[0];

    return (screenshot || boxart || anyImage)?.url || null;
  }
}

export default ScreenScraperAPI;

// Example usage (you'll need to provide actual credentials):
/*
const screenScraper = new ScreenScraperAPI({
  devId: 'your-dev-id',
  devPassword: 'your-dev-password',
  softName: 'YourAppName',
  ssUser: 'your-username', // optional but recommended
  ssPassword: 'your-password' // optional but recommended
});
*/