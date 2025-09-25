import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

interface ClearLogoData {
  launchbox_database_id: number;
  game_name: string;
  platform_name: string;
  source_url: string;
  logo_base64: string;
  region?: string;
}

class SQLiteClearLogoImporter {
  private clearLogosDb: Database.Database | null = null;

  constructor() {
    console.log('🚀 Initializing SQLite Clear Logo Importer');
  }

  private initializeDatabase() {
    const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
    console.log(`📁 Creating Clear Logo database: ${dbPath}`);

    this.clearLogosDb = new Database(dbPath);

    // Create the clear_logos table
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

      -- Create index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_clear_logos_game_platform
      ON clear_logos(game_name, platform_name);

      CREATE INDEX IF NOT EXISTS idx_clear_logos_launchbox_id
      ON clear_logos(launchbox_database_id);
    `);

    console.log('✅ Clear Logo database initialized');
  }

  private async downloadAndProcessClearLogos() {
    console.log('🎯 Processing Clear Logos from LaunchBox metadata...');

    // From our metadata analysis, we know these Clear Logos exist:
    const knownClearLogos = [
      {
        launchbox_database_id: 34197,
        game_name: 'Bomber Man',
        platform_name: 'Arcade',
        filenames: [
          { file: '71b43f95-c9c1-48b1-bcd6-7f71af32f78e.png', region: 'Europe' },
          { file: 'a2e94e72-f7aa-4783-ae47-575b73765d63.png', region: 'Japan' },
          { file: '05927e41-42b2-44aa-b4bd-560908390ece.png', region: 'Japan' },
          { file: 'b895f997-f8e7-417f-88a0-395b62595ccb.png', region: null }
        ]
      }
    ];

    const insertStmt = this.clearLogosDb!.prepare(`
      INSERT OR IGNORE INTO clear_logos
      (launchbox_database_id, game_name, platform_name, source_url, logo_base64, region)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let successCount = 0;
    let errorCount = 0;

    for (const game of knownClearLogos) {
      // Use the first/best logo for each game
      const bestLogo = game.filenames.find(f => !f.region) || game.filenames[0];

      try {
        const imageUrl = `https://images.launchbox-app.com/${bestLogo.file}`;
        console.log(`📥 Downloading ${game.game_name} Clear Logo: ${bestLogo.file}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const sizeKB = Math.round(imageBuffer.byteLength / 1024);

        const result = insertStmt.run(
          game.launchbox_database_id,
          game.game_name,
          game.platform_name,
          imageUrl,
          base64Image,
          bestLogo.region
        );

        if (result.changes > 0) {
          console.log(`✅ ${game.game_name} (${game.platform_name}) - ${sizeKB}KB stored [${bestLogo.region || 'Global'}]`);
          successCount++;
        } else {
          console.log(`⚠️ ${game.game_name} already exists, skipped`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing ${game.game_name}: ${error}`);
        errorCount++;
      }
    }

    console.log(`🎉 Clear Logo import completed!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
  }

  private generateStats() {
    if (!this.clearLogosDb) return;

    const totalCount = this.clearLogosDb.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
    const byPlatform = this.clearLogosDb.prepare(`
      SELECT platform_name, COUNT(*) as count
      FROM clear_logos
      GROUP BY platform_name
      ORDER BY count DESC
    `).all() as { platform_name: string; count: number }[];

    console.log('\n📊 Clear Logo Database Stats:');
    console.log(`Total Clear Logos: ${totalCount.count}`);
    console.log('\nBy Platform:');
    byPlatform.forEach(platform => {
      console.log(`  ${platform.platform_name}: ${platform.count}`);
    });

    // Show sample entries
    const samples = this.clearLogosDb.prepare(`
      SELECT game_name, platform_name, region,
             LENGTH(logo_base64) as size_bytes
      FROM clear_logos
      LIMIT 5
    `).all() as { game_name: string; platform_name: string; region: string | null; size_bytes: number }[];

    console.log('\n🎮 Sample Entries:');
    samples.forEach((sample, i) => {
      const sizeKB = Math.round(sample.size_bytes * 0.75 / 1024); // Base64 is ~33% larger
      console.log(`  ${i + 1}. ${sample.game_name} (${sample.platform_name}) [${sample.region || 'Global'}] - ~${sizeKB}KB`);
    });
  }

  async run() {
    try {
      this.initializeDatabase();
      await this.downloadAndProcessClearLogos();
      this.generateStats();

      console.log('\n🎯 Clear Logo database ready at: public/clear-logos.db');
      console.log('📖 You can now use this database for Clear Logo lookups in your application');

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

// Run the importer
const importer = new SQLiteClearLogoImporter();
importer.run();