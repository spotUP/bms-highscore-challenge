import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import sharp from 'sharp';

interface ClearLogoEntry {
  databaseId: number;
  fileName: string;
  region?: string;
}

interface ImportCheckpoint {
  totalLogos: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  lastDatabaseId: number;
  timestamp: string;
}

// Only include these 62 mainstream platforms (final list)
const INCLUDED_PLATFORMS = [
  'Arcade',
  'Atari Jaguar',
  'Atari Jaguar CD',
  'Atari Lynx',
  'Atari ST',
  'Bally Astrocade',
  'Commodore 64',
  'Commodore Amiga',
  'Commodore Amiga CD32',
  'Commodore CDTV',
  'Fujitsu FM Towns Marty',
  'MUGEN',
  'Namco System 22',
  'NEC PC-FX',
  'NEC TurboGrafx-16',
  'NEC TurboGrafx-CD',
  'Nintendo 3DS',
  'Nintendo 64',
  'Nintendo 64DD',
  'Nintendo Entertainment System',
  'Nintendo Famicom Disk System',
  'Nintendo Game & Watch',
  'Nintendo Game Boy',
  'Nintendo Game Boy Advance',
  'Nintendo Game Boy Color',
  'Nintendo GameCube',
  'Nintendo Satellaview',
  'Nintendo Wii U',
  'OpenBOR',
  'PC Engine SuperGrafx',
  'Pinball',
  'Sammy Atomiswave',
  'Sega 32X',
  'Sega CD',
  'Sega CD 32X',
  'Sega Dreamcast',
  'Sega Game Gear',
  'Sega Genesis',
  'Sega Hikaru',
  'Sega Master System',
  'Sega Model 1',
  'Sega Model 2',
  'Sega Model 3',
  'Sega Naomi',
  'Sega Naomi 2',
  'Sega Saturn',
  'Sega SC-3000',
  'Sega SG-1000',
  'Sega ST-V',
  'Sega System 16',
  'Sega System 32',
  'Sega Triforce',
  'Sharp X68000',
  'SNK Neo Geo AES',
  'SNK Neo Geo CD',
  'SNK Neo Geo MVS',
  'SNK Neo Geo Pocket',
  'SNK Neo Geo Pocket Color',
  'Super Nintendo Entertainment System',
  'Taito Type X',
  'WonderSwan',
  'WonderSwan Color'
];

// Exclude games with these genres (not suitable for highscore competitions)
const EXCLUDED_GENRES = [
  'Board Game',
  'Casino',
  'Compilation',
  'Education',
  'Life Simulation',
  'Music',
  'Party',
  'Quiz',
  'Role-Playing',
  'Strategy',
  'Visual Novel'
];

interface GameEntry {
  databaseId: number;
  name: string;
  platform: string;
  genres?: string[];
}

class FullClearLogoImporter {
  private clearLogosDb: Database.Database | null = null;
  private clearLogos: ClearLogoEntry[] = [];
  private games: Map<number, GameEntry> = new Map();
  private checkpointPath: string;

  constructor() {
    console.log('🚀 Full Clear Logo Importer Starting');
    this.checkpointPath = path.join(process.cwd(), 'clear-logo-checkpoint.json');
  }

  private initializeDatabase() {
    const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
    console.log(`📁 Initializing Clear Logo database: ${dbPath}`);

    this.clearLogosDb = new Database(dbPath);

    // Create the clear_logos table if it doesn't exist (preserving existing data)
    this.clearLogosDb.exec(`
      CREATE TABLE IF NOT EXISTS clear_logos (
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
      CREATE INDEX IF NOT EXISTS idx_clear_logos_game_platform ON clear_logos(game_name, platform_name);
      CREATE INDEX IF NOT EXISTS idx_clear_logos_launchbox_id ON clear_logos(launchbox_database_id);
    `);

    // Check existing progress
    const existingCount = this.clearLogosDb.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
    if (existingCount.count > 0) {
      console.log(`📊 Found existing database with ${existingCount.count.toLocaleString()} Clear Logos`);
    }

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
    let platformFilteredCount = 0;
    let genreFilteredCount = 0;

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
          // Only include mainstream platforms
          if (INCLUDED_PLATFORMS.includes(currentGame.platform)) {
            platformFilteredCount++;
            // Check if game has any excluded genres
            const hasExcludedGenre = currentGame.genres && currentGame.genres.length > 0 &&
              currentGame.genres.some(genre => EXCLUDED_GENRES.includes(genre));

            if (hasExcludedGenre) {
              genreFilteredCount++;
            } else {
              this.games.set(currentGame.databaseId, currentGame as GameEntry);
            }
          }
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
        } else if (trimmedLine.includes('<Genres>') && trimmedLine.includes('</Genres>')) {
          const match = trimmedLine.match(/<Genres>(.*?)<\/Genres>/);
          if (match && currentGame) {
            if (match[1].trim()) {
              // Split genres by semicolon and clean them up
              currentGame.genres = match[1].split(';').map(g => g.trim()).filter(g => g);
            } else {
              // Empty genres tag
              currentGame.genres = [];
            }
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
    console.log(`🏆 Platform filter: ${platformFilteredCount.toLocaleString()} games passed platform filter`);
    console.log(`🚫 Genre filter: ${genreFilteredCount.toLocaleString()} games excluded by genre filter`);
    console.log(`🎮 Found ${this.games.size.toLocaleString()} games (after platform and genre filtering)`);
    console.log(`🖼️ Found ${this.clearLogos.length.toLocaleString()} Clear Logo entries`);

    // Filter Clear Logo entries to only include games from allowed platforms and genres
    const originalLogoCount = this.clearLogos.length;
    this.clearLogos = this.clearLogos.filter(logo => this.games.has(logo.databaseId));
    console.log(`🔍 Filtered to ${this.clearLogos.length.toLocaleString()} Clear Logo entries for mainstream platforms and allowed genres`);
    console.log(`📉 Excluded ${(originalLogoCount - this.clearLogos.length).toLocaleString()} logos from removed platforms and excluded genres`);

    // Further deduplication: Keep only one logo per game (prefer Global region, then any region)
    const filteredLogoCount = this.clearLogos.length;
    const bestLogoPerGame = new Map<number, ClearLogoEntry>();

    for (const logo of this.clearLogos) {
      const existing = bestLogoPerGame.get(logo.databaseId);
      if (!existing) {
        bestLogoPerGame.set(logo.databaseId, logo);
      } else {
        // Prefer logos without region (global), then keep existing
        if (!logo.region && existing.region) {
          bestLogoPerGame.set(logo.databaseId, logo);
        } else if (logo.region === 'Global' && existing.region !== 'Global' && existing.region) {
          bestLogoPerGame.set(logo.databaseId, logo);
        }
        // Otherwise keep the existing one
      }
    }

    this.clearLogos = Array.from(bestLogoPerGame.values());
    console.log(`🎯 Deduplicated to ${this.clearLogos.length.toLocaleString()} unique Clear Logo entries (one per game)`);
    console.log(`📉 Removed ${(filteredLogoCount - this.clearLogos.length).toLocaleString()} duplicate regional variants`);
  }


  private loadCheckpoint(): ImportCheckpoint | null {
    if (fs.existsSync(this.checkpointPath)) {
      try {
        const checkpointData = fs.readFileSync(this.checkpointPath, 'utf-8');
        const checkpoint = JSON.parse(checkpointData) as ImportCheckpoint;
        console.log(`📋 Loaded checkpoint: ${checkpoint.processedCount}/${checkpoint.totalLogos} processed, last ID: ${checkpoint.lastDatabaseId}`);
        return checkpoint;
      } catch (error) {
        console.warn('⚠️ Failed to load checkpoint, starting fresh:', error);
        return null;
      }
    }
    return null;
  }

  private saveCheckpoint(checkpoint: ImportCheckpoint): void {
    try {
      fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
    } catch (error) {
      console.warn('⚠️ Failed to save checkpoint:', error);
    }
  }

  private async downloadSingleLogo(databaseId: number, logo: ClearLogoEntry, game: GameEntry, insertStmt: any): Promise<{success: boolean, sizeKB?: number, originalSizeKB?: number, error?: string}> {
    try {
      const imageUrl = `https://images.launchbox-app.com/${logo.fileName}`;

      const response = await fetch(imageUrl);
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false }; // Image not found, skip silently
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const originalImageBuffer = await response.arrayBuffer();
      const originalSizeKB = Math.round(originalImageBuffer.byteLength / 1024);

      // Convert to WebP with faster processing (optimized for speed)
      const webpBuffer = await sharp(Buffer.from(originalImageBuffer))
        .webp({ quality: 80, effort: 2 }) // Lower effort for faster conversion
        .toBuffer();

      const base64Image = webpBuffer.toString('base64');
      const sizeKB = Math.round(webpBuffer.byteLength / 1024);

      const result = insertStmt.run(
        databaseId,
        game.name,
        game.platform,
        imageUrl,
        base64Image,
        logo.region || null
      );

      return result.changes > 0 ? { success: true, sizeKB, originalSizeKB } : { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async batchDownloadLogos(): Promise<void> {
    console.log(`🚀 Starting batch download of ${this.clearLogos.length} Clear Logos...`);

    const insertStmt = this.clearLogosDb!.prepare(`
      INSERT OR IGNORE INTO clear_logos
      (launchbox_database_id, game_name, platform_name, source_url, logo_base64, region)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Load existing checkpoint
    const existingCheckpoint = this.loadCheckpoint();
    let successCount = existingCheckpoint?.successCount || 0;
    let errorCount = existingCheckpoint?.errorCount || 0;
    let skippedCount = existingCheckpoint?.skippedCount || 0;
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

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
    let processedCount = existingCheckpoint?.processedCount || 0;

    // Get existing logos to skip them
    const existingLogosStmt = this.clearLogosDb!.prepare('SELECT launchbox_database_id FROM clear_logos');
    const existingLogos = new Set<number>();
    for (const row of existingLogosStmt.iterate()) {
      existingLogos.add((row as { launchbox_database_id: number }).launchbox_database_id);
    }

    console.log(`💾 Skipping ${existingLogos.size} already downloaded logos`);

    // Sort by database ID for consistent processing order
    const sortedGameLogos = Array.from(gameLogos.entries()).sort(([a], [b]) => a - b);

    // Filter out already processed items if resuming
    const remainingLogos = existingCheckpoint
      ? sortedGameLogos.filter(([databaseId]) => databaseId > existingCheckpoint.lastDatabaseId)
      : sortedGameLogos.filter(([databaseId]) => !existingLogos.has(databaseId));

    console.log(`🔄 ${remainingLogos.length} logos remaining to process`);
    console.log(`⚡ Using concurrent downloads with controlled rate limiting for faster processing`);

    // Process in batches with controlled concurrency - optimized for speed
    const BATCH_SIZE = 15; // Number of concurrent downloads (increased from 5)
    const BATCH_DELAY = 100; // Delay between batches in ms (reduced from 250)

    for (let i = 0; i < remainingLogos.length; i += BATCH_SIZE) {
      const batch = remainingLogos.slice(i, i + BATCH_SIZE);

      // Process batch concurrently
      const batchPromises = batch.map(async ([databaseId, logo]) => {
        const game = this.games.get(databaseId);
        if (!game) {
          return { databaseId, result: { success: false, skipped: true } };
        }

        // Skip non-included platforms
        if (!INCLUDED_PLATFORMS.includes(game.platform)) {
          return { databaseId, result: { success: false, skipped: true, reason: 'Platform not in inclusion list' } };
        }

        const result = await this.downloadSingleLogo(databaseId, logo, game, insertStmt);
        return { databaseId, logo, game, result };
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      for (const settledResult of batchResults) {
        processedCount++;

        if (settledResult.status === 'fulfilled') {
          const { databaseId, logo, game, result } = settledResult.value;

          if (result.skipped) {
            skippedCount++;
            continue;
          }

          if (result.success && result.sizeKB) {
            successCount++;
            if (result.originalSizeKB) totalOriginalSize += result.originalSizeKB;
            if (result.sizeKB) totalCompressedSize += result.sizeKB;

            if (successCount % 50 === 0) {
              const compressionRatio = result.originalSizeKB ? Math.round((1 - result.sizeKB / result.originalSizeKB) * 100) : 0;
              console.log(`✅ ${game.name} (${game.platform}) - ${result.sizeKB}KB WebP (${compressionRatio}% smaller) [${logo.region || 'Global'}]`);
            }
          } else if (result.error) {
            errorCount++;
            if (errorCount % 10 === 0) {
              console.error(`❌ Error processing ${game.name}: ${result.error}`);
            }
          } else {
            skippedCount++;
          }

          // Save checkpoint every 500 successful imports
          if (successCount > 0 && successCount % 500 === 0) {
            const checkpoint: ImportCheckpoint = {
              totalLogos: totalGames,
              processedCount,
              successCount,
              errorCount,
              skippedCount,
              lastDatabaseId: databaseId,
              timestamp: new Date().toISOString()
            };
            this.saveCheckpoint(checkpoint);
            console.log(`💾 Checkpoint saved at ${successCount} successful imports`);
          }
        } else {
          errorCount++;
          if (errorCount % 10 === 0) {
            console.error(`❌ Batch processing error: ${settledResult.reason}`);
          }
        }
      }

      // Progress reporting
      if (processedCount % 100 === 0) {
        const percentage = ((processedCount / totalGames) * 100).toFixed(1);
        console.log(`📊 Progress: ${processedCount}/${totalGames} (${percentage}%) - Success: ${successCount}, Errors: ${errorCount}`);
      }

      // Rate limiting between batches - be respectful to LaunchBox servers
      if (i + BATCH_SIZE < remainingLogos.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    console.log(`🎉 Clear Logo import completed!`);
    console.log(`✅ Success: ${successCount.toLocaleString()}`);
    console.log(`❌ Errors: ${errorCount.toLocaleString()}`);
    console.log(`⚠️ Skipped: ${skippedCount.toLocaleString()}`);
    console.log(`📊 Total processed: ${totalGames.toLocaleString()}`);

    if (totalOriginalSize > 0 && totalCompressedSize > 0) {
      const overallCompressionRatio = Math.round((1 - totalCompressedSize / totalOriginalSize) * 100);
      const savedMB = Math.round((totalOriginalSize - totalCompressedSize) / 1024);
      console.log(`🗜️ WebP Compression: ${overallCompressionRatio}% smaller (saved ${savedMB.toLocaleString()}MB)`);
      console.log(`📉 Original size: ${Math.round(totalOriginalSize / 1024).toLocaleString()}MB → Compressed: ${Math.round(totalCompressedSize / 1024).toLocaleString()}MB`);
    }

    // Clean up checkpoint file on successful completion
    if (fs.existsSync(this.checkpointPath)) {
      fs.unlinkSync(this.checkpointPath);
      console.log(`🧹 Removed checkpoint file - import completed successfully`);
    }
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