// Clear Logo service using chunked SQLite databases
// This service provides Clear Logo images from chunked SQLite files
// optimized for browser loading and Vercel deployment

import initSqlJs from 'sql.js';
// Import WASM files as assets to get proper Vite URLs
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import wasmDebugUrl from 'sql.js/dist/sql-wasm-debug.wasm?url';

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
  private isInitialized = false;
  private chunkInfo: any = null;
  private loadedChunks: Record<string, any> = {};
  private SQL: any = null;

  private async initializeDatabase(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Initialize SQL.js first - this is critical
      if (!this.SQL) {
        console.log('🔧 Initializing SQL.js...');
        try {
          console.log('🔧 Using Vite asset URLs for WASM files');
          console.log(`📁 WASM URL: ${wasmUrl}`);
          console.log(`📁 WASM Debug URL: ${wasmDebugUrl}`);

          this.SQL = await initSqlJs({
            locateFile: (file: string) => {
              // Use the imported asset URLs based on the filename
              if (file === 'sql-wasm.wasm') {
                console.log(`🔍 SQL.js requesting: ${file} -> ${wasmUrl}`);
                return wasmUrl;
              } else if (file === 'sql-wasm-debug.wasm') {
                console.log(`🔍 SQL.js requesting: ${file} -> ${wasmDebugUrl}`);
                return wasmDebugUrl;
              } else {
                console.log(`🔍 SQL.js requesting unknown file: ${file}`);
                return file; // Fallback
              }
            }
          });
          console.log('✅ SQL.js initialized successfully');
        } catch (sqlError) {
          console.error('❌ SQL.js initialization failed:', sqlError);
          throw sqlError;
        }
      }

      // Load chunk info to understand the structure (optional)
      try {
        const response = await fetch('/clear-logo-chunks/chunk-info.json');
        if (response.ok) {
          this.chunkInfo = await response.json();
          console.log(`📦 Clear Logo chunks available: ${this.chunkInfo.totalChunks} chunks, ${this.chunkInfo.totalLogos} logos`);
        } else {
          console.log('📦 Chunk info not available, proceeding without it');
        }
      } catch (chunkError) {
        console.log('📦 Chunk info not available, proceeding without it');
      }

      // Only mark as initialized if SQL.js is ready
      if (this.SQL) {
        this.isInitialized = true;
        return true;
      } else {
        console.error('❌ SQL.js failed to initialize');
        return false;
      }
    } catch (error) {
      console.warn('❌ Failed to initialize Clear Logo service:', error);
      return false;
    }
  }

  /**
   * Get Clear Logos for multiple games by name
   */
  async getClearLogosForGames(gameNames: string[]): Promise<Record<string, string>> {
    const initialized = await this.initializeDatabase();
    if (!initialized) {
      console.error('❌ Cannot get Clear Logos - service not initialized');
      return {};
    }

    return this.getClearLogosFromChunks(gameNames);
  }

  private async getClearLogosFromChunks(gameNames: string[]): Promise<Record<string, string>> {
    try {
      console.log('🔍 Clear Logo Chunk Search');
      console.log(`Searching for ${gameNames.length} games:`, gameNames);

      const logoMap: Record<string, string> = {};

      // Search chunks efficiently - stop when we find all games
      const maxChunksToSearch = Math.min(10, this.chunkInfo?.totalChunks || 10);

      for (let chunkIndex = 0; chunkIndex < maxChunksToSearch; chunkIndex++) {
        const chunkFile = `chunk-${chunkIndex.toString().padStart(3, '0')}.db`;

        try {
          await this.loadAndSearchChunk(chunkFile, gameNames, logoMap);

          // If we've found all games, we can stop
          if (Object.keys(logoMap).length >= gameNames.length) {
            break;
          }
        } catch (error) {
          console.warn(`❌ Failed to search chunk ${chunkFile}:`, error);
        }
      }

      console.log(`✅ Found Clear Logos for ${Object.keys(logoMap).length} out of ${gameNames.length} games`);

      // Debug: Check what we're returning
      for (const [gameName, base64] of Object.entries(logoMap)) {
        console.log(`📋 Returning logo for ${gameName}: ${base64.substring(0, 50)}... (${base64.length} chars)`);
      }

      return logoMap;
    } catch (error) {
      console.warn('Error in Clear Logo chunk search:', error);
      return {};
    }
  }

  private async loadAndSearchChunk(chunkFile: string, gameNames: string[], logoMap: Record<string, string>): Promise<void> {
    // Check if chunk is already loaded
    if (this.loadedChunks[chunkFile]) {
      this.searchLoadedChunk(this.loadedChunks[chunkFile], gameNames, logoMap);
      return;
    }

    if (!this.SQL) {
      console.warn('❌ SQL.js not initialized');
      return;
    }

    try {
      console.log(`📦 Loading chunk: ${chunkFile}`);

      // Fetch the SQLite chunk file
      const response = await fetch(`/clear-logo-chunks/${chunkFile}`);
      if (!response.ok) {
        throw new Error(`Failed to load chunk: ${response.status}`);
      }

      // Get the binary data
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Create SQL.js database from the binary data
      const db = new this.SQL.Database(uint8Array);

      // Query all games in this chunk
      const stmt = db.prepare('SELECT game_name, logo_base64 FROM clear_logos');
      const chunkData: Record<string, string> = {};

      while (stmt.step()) {
        const row = stmt.getAsObject();
        chunkData[row.game_name as string] = row.logo_base64 as string;
      }

      stmt.free();
      db.close();

      // Cache the loaded chunk data
      this.loadedChunks[chunkFile] = chunkData;

      console.log(`✅ Loaded chunk ${chunkFile}: ${Object.keys(chunkData).length} logos`);

      // Search this chunk for our games
      this.searchLoadedChunk(chunkData, gameNames, logoMap);
    } catch (error) {
      console.warn(`❌ Failed to load chunk ${chunkFile}:`, error);
      this.loadedChunks[chunkFile] = {}; // Cache empty result to avoid retry
    }
  }

  private searchLoadedChunk(chunkData: any, gameNames: string[], logoMap: Record<string, string>): void {
    // Search through loaded chunk data for matching game names
    for (const gameName of gameNames) {
      if (logoMap[gameName]) continue; // Already found

      // Look for exact match first, then fuzzy match
      if (chunkData[gameName]) {
        // Convert base64 to data URL format
        const dataUrl = `data:image/png;base64,${chunkData[gameName]}`;
        logoMap[gameName] = dataUrl;
        console.log(`🎯 Found Clear Logo for: ${gameName}`);
      }
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