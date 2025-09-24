// SQLite database service for production logo lookups
// This service provides fallback logo data when Supabase is unavailable
// or for improved performance in production
// Uses split database architecture: index + logo chunks

export interface GameLogoData {
  id: number;
  name: string;
  platform_name: string;
  logo_base64: string | null;
}

class SQLiteService {
  private indexDb: any = null;
  private logoChunks: Map<number, any> = new Map();
  private isInitialized = false;

  private isProduction(): boolean {
    return import.meta.env.PROD;
  }

  private async initializeDatabase(): Promise<boolean> {
    if (this.isInitialized) return this.indexDb !== null;

    if (typeof window === 'undefined') {
      // Server-side rendering - not available
      this.isInitialized = true;
      return false;
    }

    try {
      console.log('🔄 Loading split SQLite database...');

      // Try to load sql.js for client-side SQLite access
      const sqljs = await import('sql.js');
      const SQL = await sqljs.default({
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`
      });

      console.log('📦 SQL.js loaded, fetching games index...');

      // Load the lightweight index database first (7MB vs 2GB)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/games-index.db', {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch index database: ${response.status}`);
      }

      console.log('📇 Index database fetched, loading into SQL.js...');
      const arrayBuffer = await response.arrayBuffer();
      console.log(`📊 Index database size: ${(arrayBuffer.byteLength / 1024).toFixed(2)}KB`);

      this.indexDb = new SQL.Database(new Uint8Array(arrayBuffer));
      console.log('✅ Games index loaded successfully');
      this.isInitialized = true;
      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Index database fetch timed out after 30 seconds');
      } else {
        console.warn('Failed to load index database:', error);
      }
      this.isInitialized = true;
      return false;
    }
  }

  private async loadLogoChunk(chunkNumber: number): Promise<any> {
    if (this.logoChunks.has(chunkNumber)) {
      return this.logoChunks.get(chunkNumber);
    }

    try {
      console.log(`🖼️  Loading logo chunk ${chunkNumber}...`);

      const sqljs = await import('sql.js');
      const SQL = await sqljs.default({
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`
      });

      const response = await fetch(`/logos-${chunkNumber}.db`);
      if (!response.ok) {
        throw new Error(`Failed to fetch logo chunk ${chunkNumber}: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log(`📁 Chunk ${chunkNumber} size: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

      const chunkDb = new SQL.Database(new Uint8Array(arrayBuffer));
      this.logoChunks.set(chunkNumber, chunkDb);

      console.log(`✅ Logo chunk ${chunkNumber} loaded successfully`);
      return chunkDb;
    } catch (error) {
      console.warn(`Failed to load logo chunk ${chunkNumber}:`, error);
      return null;
    }
  }

  async getLogosForGames(gameNames: string[]): Promise<Record<string, string>> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.indexDb) {
      console.log('SQLite not initialized or index database not available');
      return {};
    }

    try {
      console.log('🔍 SQLite Logo Search (Split DB with LaunchBox offset)');
      console.log(`Searching for ${gameNames.length} games:`, gameNames);

      const logoMap: Record<string, string> = {};
      const chunksNeeded = new Set<number>();

      // Step 1: Find games in index and determine which chunks we need
      // Note: We search by name since IDs have offset issues between Supabase and SQLite
      for (const gameName of gameNames) {
        try {
          // Query index database for game info by name (more reliable than ID matching)
          const indexQuery = `SELECT id, name, has_logo, logo_chunk FROM games WHERE name = ? AND has_logo = 1 LIMIT 1`;
          const indexStmt = this.indexDb.prepare(indexQuery);
          indexStmt.bind([gameName]);

          const indexResults = [];
          while (indexStmt.step()) {
            indexResults.push(indexStmt.getAsObject());
          }
          indexStmt.free();

          if (indexResults.length > 0) {
            const game = indexResults[0];
            console.log(`✅ Found "${gameName}" in chunk ${game.logo_chunk} (SQLite ID: ${game.id})`);
            chunksNeeded.add(game.logo_chunk);
          } else {
            console.log(`❌ No logo found for "${gameName}"`);

            // Try partial match for debug
            const partialQuery = `SELECT name FROM games WHERE name LIKE ? LIMIT 3`;
            const partialStmt = this.indexDb.prepare(partialQuery);
            partialStmt.bind([`%${gameName.split(' ')[0]}%`]);
            const partialResults = [];
            while (partialStmt.step()) {
              partialResults.push(partialStmt.getAsObject());
            }
            partialStmt.free();
            if (partialResults.length > 0) {
              console.log(`🔍 Similar names found:`, partialResults.map(r => r.name));
            }
          }
        } catch (error) {
          console.warn(`Error searching index for "${gameName}":`, error);
        }
      }

      // Step 2: Load needed logo chunks
      console.log(`📦 Loading ${chunksNeeded.size} logo chunks: [${Array.from(chunksNeeded).join(', ')}]`);
      for (const chunkNumber of chunksNeeded) {
        await this.loadLogoChunk(chunkNumber);
      }

      // Step 3: Get logos from chunks using exact game IDs
      for (const gameName of gameNames) {
        try {
          // Get game info from index again
          const indexQuery = `SELECT id, logo_chunk FROM games WHERE name = ? AND has_logo = 1 LIMIT 1`;
          const indexStmt = this.indexDb.prepare(indexQuery);
          indexStmt.bind([gameName]);

          const indexResults = [];
          while (indexStmt.step()) {
            indexResults.push(indexStmt.getAsObject());
          }
          indexStmt.free();

          if (indexResults.length > 0) {
            const game = indexResults[0];
            const chunkDb = this.logoChunks.get(game.logo_chunk);

            if (chunkDb) {
              // Query logo chunk using the SQLite's original LaunchBox ID
              const logoQuery = `SELECT logo_base64 FROM logos WHERE game_id = ? LIMIT 1`;
              const logoStmt = chunkDb.prepare(logoQuery);
              logoStmt.bind([game.id]);

              const logoResults = [];
              while (logoStmt.step()) {
                logoResults.push(logoStmt.getAsObject());
              }
              logoStmt.free();

              if (logoResults.length > 0 && logoResults[0].logo_base64) {
                console.log(`🖼️  Got logo for "${gameName}" from chunk ${game.logo_chunk} (SQLite ID: ${game.id})`);
                logoMap[gameName] = logoResults[0].logo_base64;
              }
            }
          }
        } catch (error) {
          console.warn(`Error getting logo for "${gameName}":`, error);
        }
      }

      console.log(`✅ Found logos for ${Object.keys(logoMap).length} out of ${gameNames.length} games`);
      return logoMap;
    } catch (error) {
      console.warn('Error in split database logo search:', error);
      return {};
    }
  }

  async searchGamesByName(searchTerm: string, limit: number = 20): Promise<GameLogoData[]> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.indexDb) {
      return [];
    }

    try {
      console.log(`🔍 Searching games: "${searchTerm}"`);

      // Search index database first
      const query = `
        SELECT id, name, platform_name, has_logo, logo_chunk
        FROM games
        WHERE name LIKE ?
        ORDER BY has_logo DESC, name
        LIMIT ?
      `;

      const stmt = this.indexDb.prepare(query);
      stmt.bind([`%${searchTerm}%`, limit]);
      const indexResults = [];
      while (stmt.step()) {
        indexResults.push(stmt.getAsObject());
      }
      stmt.free();

      console.log(`📋 Found ${indexResults.length} games in index`);

      // Convert to GameLogoData format and load logos for games that have them
      const results: GameLogoData[] = [];
      const chunksNeeded = new Set<number>();

      // Collect chunks we'll need
      for (const game of indexResults) {
        if (game.has_logo && game.logo_chunk) {
          chunksNeeded.add(game.logo_chunk);
        }
      }

      // Load needed chunks
      if (chunksNeeded.size > 0) {
        console.log(`📦 Loading chunks: [${Array.from(chunksNeeded).join(', ')}]`);
        for (const chunkNumber of chunksNeeded) {
          await this.loadLogoChunk(chunkNumber);
        }
      }

      // Get logos for each game
      for (const game of indexResults) {
        let logo_base64: string | null = null;

        if (game.has_logo && game.logo_chunk && this.logoChunks.has(game.logo_chunk)) {
          try {
            const chunkDb = this.logoChunks.get(game.logo_chunk);
            const logoStmt = chunkDb.prepare('SELECT logo_base64 FROM logos WHERE game_id = ? LIMIT 1');
            logoStmt.bind([game.id]);

            const logoResults = [];
            while (logoStmt.step()) {
              logoResults.push(logoStmt.getAsObject());
            }
            logoStmt.free();

            if (logoResults.length > 0) {
              logo_base64 = logoResults[0].logo_base64;
            }
          } catch (error) {
            console.warn(`Error getting logo for game ${game.id}:`, error);
          }
        }

        results.push({
          id: game.id,
          name: game.name,
          platform_name: game.platform_name,
          logo_base64
        });
      }

      console.log(`✅ Returning ${results.length} games (${results.filter(g => g.logo_base64).length} with logos)`);
      return results;
    } catch (error) {
      console.warn('Error searching split database:', error);
      return [];
    }
  }

  async getGameById(id: number): Promise<GameLogoData | null> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.indexDb) {
      return null;
    }

    try {
      console.log(`🎯 Getting game by ID: ${id}`);

      // Get game info from index
      const indexQuery = `SELECT id, name, platform_name, has_logo, logo_chunk FROM games WHERE id = ? LIMIT 1`;
      const indexStmt = this.indexDb.prepare(indexQuery);
      indexStmt.bind([id]);

      const indexResults = [];
      while (indexStmt.step()) {
        indexResults.push(indexStmt.getAsObject());
      }
      indexStmt.free();

      if (indexResults.length === 0) {
        console.log(`❌ Game with ID ${id} not found`);
        return null;
      }

      const game = indexResults[0];
      let logo_base64: string | null = null;

      // Get logo if available
      if (game.has_logo && game.logo_chunk) {
        const chunkDb = await this.loadLogoChunk(game.logo_chunk);
        if (chunkDb) {
          try {
            const logoStmt = chunkDb.prepare('SELECT logo_base64 FROM logos WHERE game_id = ? LIMIT 1');
            logoStmt.bind([game.id]);

            const logoResults = [];
            while (logoStmt.step()) {
              logoResults.push(logoStmt.getAsObject());
            }
            logoStmt.free();

            if (logoResults.length > 0) {
              logo_base64 = logoResults[0].logo_base64;
              console.log(`✅ Got logo for game ${id} from chunk ${game.logo_chunk}`);
            }
          } catch (error) {
            console.warn(`Error getting logo for game ${id}:`, error);
          }
        }
      }

      return {
        id: game.id,
        name: game.name,
        platform_name: game.platform_name,
        logo_base64
      };
    } catch (error) {
      console.warn(`Error querying split database for game ${id}:`, error);
      return null;
    }
  }

  // Clean up database connections when done
  close(): void {
    if (this.indexDb) {
      this.indexDb.close();
      this.indexDb = null;
    }

    for (const [chunkNumber, chunkDb] of this.logoChunks) {
      if (chunkDb) {
        chunkDb.close();
      }
    }
    this.logoChunks.clear();
    this.isInitialized = false;
  }
}

export const sqliteService = new SQLiteService();