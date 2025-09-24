// Clear Logo service using SQLite database
// This service provides Clear Logo images from the locally stored database
// instead of web scraping LaunchBox

export interface ClearLogoData {
  id: number;
  launchbox_database_id: number;
  game_name: string;
  platform_name: string;
  source_url: string;
  logo_base64: string;
  region?: string;
  created_at: string;
}

class ClearLogoService {
  private clearLogosDb: any = null;
  private isInitialized = false;

  private isProduction(): boolean {
    return import.meta.env.PROD;
  }

  private async initializeDatabase(): Promise<boolean> {
    if (this.isInitialized) return this.clearLogosDb !== null;

    if (typeof window === 'undefined') {
      // Server-side rendering - not available
      this.isInitialized = true;
      return false;
    }

    try {
      console.log('🔄 Loading Clear Logo SQLite database...');

      // Load sql.js for client-side SQLite access
      const sqljs = await import('sql.js');
      const SQL = await sqljs.default({
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`
      });

      console.log('📦 SQL.js loaded, fetching Clear Logo database...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/clear-logos.db', {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch Clear Logo database: ${response.status}`);
      }

      console.log('📇 Clear Logo database fetched, loading into SQL.js...');
      const arrayBuffer = await response.arrayBuffer();
      const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
      console.log(`📊 Clear Logo database size: ${sizeMB}MB`);

      this.clearLogosDb = new SQL.Database(new Uint8Array(arrayBuffer));
      console.log('✅ Clear Logo database loaded successfully');

      // Test query to ensure database is working
      const testQuery = 'SELECT COUNT(*) as count FROM clear_logos';
      const testStmt = this.clearLogosDb.prepare(testQuery);
      testStmt.step();
      const result = testStmt.getAsObject();
      testStmt.free();

      console.log(`🎯 Clear Logo database contains ${result.count} logos`);
      this.isInitialized = true;
      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Clear Logo database fetch timed out after 30 seconds');
      } else {
        console.warn('Failed to load Clear Logo database:', error);
      }
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Get Clear Logos for multiple games by name
   */
  async getClearLogosForGames(gameNames: string[]): Promise<Record<string, string>> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.clearLogosDb) {
      console.log('Clear Logo database not initialized or not available');
      return {};
    }

    try {
      console.log('🔍 Clear Logo Search');
      console.log(`Searching for ${gameNames.length} games:`, gameNames);

      const logoMap: Record<string, string> = {};

      for (const gameName of gameNames) {
        try {
          // Search by exact game name match
          const query = `
            SELECT logo_base64, region, platform_name
            FROM clear_logos
            WHERE game_name = ?
            ORDER BY
              CASE WHEN region IS NULL THEN 0 ELSE 1 END,
              region
            LIMIT 1
          `;

          const stmt = this.clearLogosDb.prepare(query);
          stmt.bind([gameName]);

          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();

          if (results.length > 0 && results[0].logo_base64) {
            console.log(`🖼️ Found Clear Logo for "${gameName}" (${results[0].platform_name}) [${results[0].region || 'Global'}]`);
            logoMap[gameName] = results[0].logo_base64;
          } else {
            console.log(`❌ No Clear Logo found for "${gameName}"`);

            // Try partial match for debug
            const partialQuery = `
              SELECT game_name, platform_name
              FROM clear_logos
              WHERE game_name LIKE ?
              LIMIT 3
            `;
            const partialStmt = this.clearLogosDb.prepare(partialQuery);
            partialStmt.bind([`%${gameName.split(' ')[0]}%`]);

            const partialResults = [];
            while (partialStmt.step()) {
              partialResults.push(partialStmt.getAsObject());
            }
            partialStmt.free();

            if (partialResults.length > 0) {
              console.log(`🔍 Similar names found:`, partialResults.map(r => `${r.game_name} (${r.platform_name})`));
            }
          }
        } catch (error) {
          console.warn(`Error searching Clear Logo for "${gameName}":`, error);
        }
      }

      console.log(`✅ Found Clear Logos for ${Object.keys(logoMap).length} out of ${gameNames.length} games`);
      return logoMap;
    } catch (error) {
      console.warn('Error in Clear Logo search:', error);
      return {};
    }
  }

  /**
   * Search Clear Logos by game name pattern
   */
  async searchClearLogos(searchTerm: string, limit: number = 20): Promise<ClearLogoData[]> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.clearLogosDb) {
      return [];
    }

    try {
      console.log(`🔍 Searching Clear Logos: "${searchTerm}"`);

      const query = `
        SELECT id, launchbox_database_id, game_name, platform_name,
               source_url, logo_base64, region, created_at
        FROM clear_logos
        WHERE game_name LIKE ?
        ORDER BY
          CASE WHEN region IS NULL THEN 0 ELSE 1 END,
          game_name
        LIMIT ?
      `;

      const stmt = this.clearLogosDb.prepare(query);
      stmt.bind([`%${searchTerm}%`, limit]);

      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();

      console.log(`📋 Found ${results.length} Clear Logo matches`);

      return results.map(row => ({
        id: row.id,
        launchbox_database_id: row.launchbox_database_id,
        game_name: row.game_name,
        platform_name: row.platform_name,
        source_url: row.source_url,
        logo_base64: row.logo_base64,
        region: row.region,
        created_at: row.created_at
      }));
    } catch (error) {
      console.warn('Error searching Clear Logo database:', error);
      return [];
    }
  }

  /**
   * Get Clear Logo by LaunchBox database ID
   */
  async getClearLogoById(launchboxId: number): Promise<ClearLogoData | null> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.clearLogosDb) {
      return null;
    }

    try {
      console.log(`🎯 Getting Clear Logo by LaunchBox ID: ${launchboxId}`);

      const query = `
        SELECT id, launchbox_database_id, game_name, platform_name,
               source_url, logo_base64, region, created_at
        FROM clear_logos
        WHERE launchbox_database_id = ?
        ORDER BY
          CASE WHEN region IS NULL THEN 0 ELSE 1 END
        LIMIT 1
      `;

      const stmt = this.clearLogosDb.prepare(query);
      stmt.bind([launchboxId]);

      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();

      if (results.length === 0) {
        console.log(`❌ Clear Logo with LaunchBox ID ${launchboxId} not found`);
        return null;
      }

      const row = results[0];
      console.log(`✅ Found Clear Logo for ${row.game_name} (${row.platform_name}) [${row.region || 'Global'}]`);

      return {
        id: row.id,
        launchbox_database_id: row.launchbox_database_id,
        game_name: row.game_name,
        platform_name: row.platform_name,
        source_url: row.source_url,
        logo_base64: row.logo_base64,
        region: row.region,
        created_at: row.created_at
      };
    } catch (error) {
      console.warn(`Error querying Clear Logo database for ID ${launchboxId}:`, error);
      return null;
    }
  }

  /**
   * Get statistics about the Clear Logo database
   */
  async getStats(): Promise<{ total: number; byPlatform: Array<{ platform: string; count: number }> } | null> {
    const initialized = await this.initializeDatabase();
    if (!initialized || !this.clearLogosDb) {
      return null;
    }

    try {
      // Get total count
      const totalQuery = 'SELECT COUNT(*) as count FROM clear_logos';
      const totalStmt = this.clearLogosDb.prepare(totalQuery);
      totalStmt.step();
      const total = totalStmt.getAsObject().count;
      totalStmt.free();

      // Get count by platform
      const platformQuery = `
        SELECT platform_name as platform, COUNT(*) as count
        FROM clear_logos
        GROUP BY platform_name
        ORDER BY count DESC
        LIMIT 10
      `;
      const platformStmt = this.clearLogosDb.prepare(platformQuery);

      const byPlatform = [];
      while (platformStmt.step()) {
        byPlatform.push(platformStmt.getAsObject());
      }
      platformStmt.free();

      return { total, byPlatform };
    } catch (error) {
      console.warn('Error getting Clear Logo database stats:', error);
      return null;
    }
  }

  // Clean up database connections when done
  close(): void {
    if (this.clearLogosDb) {
      this.clearLogosDb.close();
      this.clearLogosDb = null;
    }
    this.isInitialized = false;
  }
}

export const clearLogoService = new ClearLogoService();