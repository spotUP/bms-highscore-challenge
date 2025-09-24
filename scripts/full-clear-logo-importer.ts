import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

interface ClearLogoEntry {
  databaseId: number;
  fileName: string;
  region?: string;
}

interface GameEntry {
  databaseId: number;
  name: string;
  platform: string;
}

class FullClearLogoImporter {
  private clearLogosDb: Database.Database | null = null;
  private clearLogos: ClearLogoEntry[] = [];
  private games: Map<number, GameEntry> = new Map();

  constructor() {
    console.log('🚀 Full Clear Logo Importer Starting');
  }

  private initializeDatabase() {
    const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
    console.log(`📁 Initializing Clear Logo database: ${dbPath}`);

    this.clearLogosDb = new Database(dbPath);

    // Create the clear_logos table (drop and recreate to start fresh)
    this.clearLogosDb.exec(`
      DROP TABLE IF EXISTS clear_logos;

      CREATE TABLE clear_logos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        launchbox_database_id INTEGER NOT NULL,
        game_name TEXT NOT NULL,
        platform_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        logo_base64 TEXT NOT NULL,
        region TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        -- Prevent duplicates
        UNIQUE(launchbox_database_id, region)
      );

      -- Create indexes for faster lookups
      CREATE INDEX idx_clear_logos_game_platform ON clear_logos(game_name, platform_name);
      CREATE INDEX idx_clear_logos_launchbox_id ON clear_logos(launchbox_database_id);
    `);

    console.log('✅ Clear Logo database initialized');
  }

  private async parseMetadataXML(): Promise<void> {
    console.log('📖 Processing Metadata.xml for games and Clear Logo entries...');

    const metadataPath = path.join(process.cwd(), 'Metadata.xml');
    if (!fs.existsSync(metadataPath)) {
      throw new Error('Metadata.xml not found. Please ensure it is downloaded.');
    }

    const fileStream = createReadStream(metadataPath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentGame: Partial<GameEntry> | null = null;
    let inGame = false;
    let inGameImage = false;
    let currentImage: Partial<ClearLogoEntry> | null = null;
    let lineCount = 0;

    for await (const line of rl) {
      lineCount++;

      if (lineCount % 100000 === 0) {
        console.log(`📄 Processed ${lineCount.toLocaleString()} lines...`);
      }

      const trimmedLine = line.trim();

      // Game parsing
      if (trimmedLine === '<Game>') {
        inGame = true;
        currentGame = {};
      } else if (trimmedLine === '</Game>' && inGame) {
        if (currentGame?.databaseId && currentGame.name && currentGame.platform) {
          this.games.set(currentGame.databaseId, currentGame as GameEntry);
        }
        inGame = false;
        currentGame = null;
      } else if (inGame) {
        if (trimmedLine.includes('<Name>') && trimmedLine.includes('</Name>')) {
          const match = trimmedLine.match(/<Name>(.*?)<\/Name>/);
          if (match && currentGame) {
            currentGame.name = match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          }
        } else if (trimmedLine.includes('<DatabaseID>') && trimmedLine.includes('</DatabaseID>')) {
          const match = trimmedLine.match(/<DatabaseID>(\d+)<\/DatabaseID>/);
          if (match && currentGame) {
            currentGame.databaseId = parseInt(match[1]);
          }
        } else if (trimmedLine.includes('<Platform>') && trimmedLine.includes('</Platform>')) {
          const match = trimmedLine.match(/<Platform>(.*?)<\/Platform>/);
          if (match && currentGame) {
            currentGame.platform = match[1];
          }
        }
      }

      // GameImage parsing
      if (trimmedLine === '<GameImage>') {
        inGameImage = true;
        currentImage = {};
      } else if (trimmedLine === '</GameImage>' && inGameImage) {
        if (currentImage?.databaseId && currentImage.fileName) {
          this.clearLogos.push(currentImage as ClearLogoEntry);
        }
        inGameImage = false;
        currentImage = null;
      } else if (inGameImage) {
        if (trimmedLine.includes('<DatabaseID>') && trimmedLine.includes('</DatabaseID>')) {
          const match = trimmedLine.match(/<DatabaseID>(\d+)<\/DatabaseID>/);
          if (match && currentImage) {
            currentImage.databaseId = parseInt(match[1]);
          }
        } else if (trimmedLine.includes('<FileName>') && trimmedLine.includes('</FileName>')) {
          const match = trimmedLine.match(/<FileName>(.*?)<\/FileName>/);
          if (match && currentImage) {
            currentImage.fileName = match[1];
          }
        } else if (trimmedLine.includes('<Type>') && trimmedLine.includes('</Type>')) {
          const match = trimmedLine.match(/<Type>(.*?)<\/Type>/);
          if (match && currentImage && match[1] !== 'Clear Logo') {
            // Not a Clear Logo, reset currentImage
            currentImage = null;
          }
        } else if (trimmedLine.includes('<Region>') && trimmedLine.includes('</Region>')) {
          const match = trimmedLine.match(/<Region>(.*?)<\/Region>/);
          if (match && currentImage) {
            currentImage.region = match[1];
          }
        }
      }
    }

    console.log(`✅ Parsed ${lineCount.toLocaleString()} lines`);
    console.log(`🎮 Found ${this.games.size.toLocaleString()} games`);
    console.log(`🖼️ Found ${this.clearLogos.length.toLocaleString()} Clear Logo entries`);
  }

  private async batchDownloadLogos(): Promise<void> {
    console.log(`🚀 Starting batch download of ${this.clearLogos.length} Clear Logos...`);

    const insertStmt = this.clearLogosDb!.prepare(`
      INSERT OR IGNORE INTO clear_logos
      (launchbox_database_id, game_name, platform_name, source_url, logo_base64, region)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Group by database ID to pick best logo for each game
    const gameLogos = new Map<number, ClearLogoEntry>();

    for (const logo of this.clearLogos) {
      if (!gameLogos.has(logo.databaseId)) {
        gameLogos.set(logo.databaseId, logo);
      } else {
        // Prefer logos without region (global), then any region
        const existing = gameLogos.get(logo.databaseId)!;
        if (!logo.region && existing.region) {
          gameLogos.set(logo.databaseId, logo);
        }
      }
    }

    console.log(`📦 Processing ${gameLogos.size} unique games (deduplicated from ${this.clearLogos.length} total entries)`);

    const totalGames = gameLogos.size;
    let processedCount = 0;

    for (const [databaseId, logo] of gameLogos) {
      processedCount++;

      if (processedCount % 100 === 0) {
        const percentage = ((processedCount / totalGames) * 100).toFixed(1);
        console.log(`📊 Progress: ${processedCount}/${totalGames} (${percentage}%) - Success: ${successCount}, Errors: ${errorCount}`);
      }

      const game = this.games.get(databaseId);
      if (!game) {
        console.log(`⚠️ Game data not found for ID ${databaseId}, skipping`);
        skippedCount++;
        continue;
      }

      try {
        const imageUrl = `https://images.launchbox-app.com/${logo.fileName}`;

        const response = await fetch(imageUrl);
        if (!response.ok) {
          if (response.status === 404) {
            // Image not found on server, skip silently
            skippedCount++;
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const sizeKB = Math.round(imageBuffer.byteLength / 1024);

        const result = insertStmt.run(
          databaseId,
          game.name,
          game.platform,
          imageUrl,
          base64Image,
          logo.region || null
        );

        if (result.changes > 0) {
          successCount++;
          if (successCount % 50 === 0) {
            console.log(`✅ ${game.name} (${game.platform}) - ${sizeKB}KB stored [${logo.region || 'Global'}]`);
          }
        }

        // Rate limiting - be respectful to LaunchBox servers
        if (processedCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        errorCount++;
        if (errorCount % 10 === 0) {
          console.error(`❌ Error processing ${game.name}: ${error}`);
        }
      }
    }

    console.log(`🎉 Clear Logo import completed!`);
    console.log(`✅ Success: ${successCount.toLocaleString()}`);
    console.log(`❌ Errors: ${errorCount.toLocaleString()}`);
    console.log(`⚠️ Skipped: ${skippedCount.toLocaleString()}`);
    console.log(`📊 Total processed: ${totalGames.toLocaleString()}`);
  }

  private generateStats() {
    if (!this.clearLogosDb) return;

    const totalCount = this.clearLogosDb.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
    const byPlatform = this.clearLogosDb.prepare(`
      SELECT platform_name, COUNT(*) as count
      FROM clear_logos
      GROUP BY platform_name
      ORDER BY count DESC
      LIMIT 10
    `).all() as { platform_name: string; count: number }[];

    const avgSize = this.clearLogosDb.prepare(`
      SELECT AVG(LENGTH(logo_base64)) as avg_bytes
      FROM clear_logos
    `).get() as { avg_bytes: number };

    console.log('\n📊 Final Clear Logo Database Stats:');
    console.log(`Total Clear Logos: ${totalCount.count.toLocaleString()}`);
    console.log(`Average Size: ~${Math.round(avgSize.avg_bytes * 0.75 / 1024)}KB`);

    console.log('\nTop 10 Platforms:');
    byPlatform.forEach(platform => {
      console.log(`  ${platform.platform_name}: ${platform.count.toLocaleString()}`);
    });

    const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
    const stats = fs.statSync(dbPath);
    console.log(`\nDatabase file size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Database location: ${dbPath}`);
  }

  async run() {
    try {
      this.initializeDatabase();
      await this.parseMetadataXML();
      await this.batchDownloadLogos();
      this.generateStats();

      console.log('\n🎯 Full Clear Logo import completed successfully!');
      console.log('📖 Your application can now use the clear-logos.db database for Clear Logo lookups');

    } catch (error) {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    } finally {
      if (this.clearLogosDb) {
        this.clearLogosDb.close();
      }
    }
  }
}

// Run the full importer
const importer = new FullClearLogoImporter();
importer.run();