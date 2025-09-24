// SQLite database service for production logo lookups
// This service provides fallback logo data when Supabase is unavailable
// or for improved performance in production

export interface GameLogoData {
  id: number;
  name: string;
  platform_name: string;
  logo_base64: string | null;
  launchbox_id: number | null;
}

class SQLiteService {
  private db: any = null;
  private isInitialized = false;

  private isProduction(): boolean {
    return import.meta.env.PROD;
  }

  private async initializeDatabase(): Promise<boolean> {
    if (this.isInitialized) return this.db !== null;

    if (typeof window === 'undefined') {
      // Server-side rendering - not available
      this.isInitialized = true;
      return false;
    }

    // In production, try to load from the static games.db file
    if (this.isProduction()) {
      try {
        // Try to load sql.js for client-side SQLite access
        const sqljs = await import('sql.js');
        const SQL = await sqljs.default({
          locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        });

        // Fetch the database file
        const response = await fetch('/games.db');
        if (!response.ok) {
          throw new Error(`Failed to fetch database: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        this.db = new SQL.Database(new Uint8Array(arrayBuffer));
        this.isInitialized = true;
        return true;
      } catch (error) {
        console.warn('Failed to load SQLite database:', error);
        this.isInitialized = true;
        return false;
      }
    }

    this.isInitialized = true;
    return false;
  }

  async getLogosForGames(gameNames: string[]): Promise<Record<string, string>> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.db) {
      return {}; // Fallback to empty if SQLite not available
    }

    try {
      const logoMap: Record<string, string> = {};

      // Query each game individually to avoid complex parameter binding
      for (const gameName of gameNames) {
        try {
          const query = `SELECT name, logo_base64 FROM games WHERE name = ? AND logo_base64 IS NOT NULL LIMIT 1`;
          const stmt = this.db.prepare(query);
          const result = stmt.getAsObject([gameName]);

          if (result && result.length > 0 && result[0].logo_base64) {
            logoMap[gameName] = result[0].logo_base64;
          }

          stmt.free();
        } catch (error) {
          console.warn(`Error querying game "${gameName}":`, error);
        }
      }

      return logoMap;
    } catch (error) {
      console.warn('Error querying SQLite database:', error);
      return {};
    }
  }

  async searchGamesByName(searchTerm: string, limit: number = 20): Promise<GameLogoData[]> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.db) {
      return [];
    }

    try {
      const query = `
        SELECT id, name, platform_name, logo_base64, launchbox_id
        FROM games
        WHERE name LIKE ?
        ORDER BY name
        LIMIT ?
      `;

      const stmt = this.db.prepare(query);
      const results = stmt.getAsObject([`%${searchTerm}%`, limit]);

      stmt.free();

      return Array.isArray(results) ? results as GameLogoData[] : [];
    } catch (error) {
      console.warn('Error searching SQLite database:', error);
      return [];
    }
  }

  async getGameById(id: number): Promise<GameLogoData | null> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.db) {
      return null;
    }

    try {
      const query = `SELECT id, name, platform_name, logo_base64, launchbox_id FROM games WHERE id = ? LIMIT 1`;
      const stmt = this.db.prepare(query);
      const result = stmt.getAsObject([id]);

      stmt.free();

      return Array.isArray(result) && result.length > 0 ? result[0] as GameLogoData : null;
    } catch (error) {
      console.warn('Error querying SQLite database:', error);
      return null;
    }
  }

  // Clean up database connection when done
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }
}

export const sqliteService = new SQLiteService();