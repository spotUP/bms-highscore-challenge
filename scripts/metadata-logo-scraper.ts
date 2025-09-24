import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://bdwqagbahfrfdckucbph.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkd3FhZ2JhaGZyZmRja3VjYnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQzNjM5NjIsImV4cCI6MjAzOTkzOTk2Mn0.mq3T4IHDGQEtGGlP1HfBiK2Ay7aGJNpRs6oc1LY9HKE';
const supabase = createClient(supabaseUrl, supabaseKey);

interface GameMetadata {
  Name: string;
  DatabaseID: number;
  Platform: string;
}

interface GameImage {
  DatabaseID: number;
  FileName: string;
  Type: string;
  Region?: string;
}

interface ClearLogoMatch {
  databaseId: number;
  gameName: string;
  platform: string;
  imageFileName: string;
  region?: string;
}

class MetadataLogoScraper {
  private gameMetadata: Map<number, GameMetadata> = new Map();
  private imageMetadata: Map<number, GameImage[]> = new Map();

  constructor() {
    console.log('🚀 Initializing Metadata Logo Scraper');
  }

  private async loadMetadata() {
    console.log('📖 Loading LaunchBox metadata...');

    const metadataPath = path.join(process.cwd(), 'Metadata.xml');
    if (!fs.existsSync(metadataPath)) {
      throw new Error('Metadata.xml not found. Please ensure it is downloaded and extracted.');
    }

    const xmlContent = fs.readFileSync(metadataPath, 'utf-8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      textNodeName: 'text'
    });

    console.log('🔍 Parsing XML metadata...');
    const result = parser.parse(xmlContent);

    // Load game metadata
    if (result.LaunchBox.Game) {
      const games = Array.isArray(result.LaunchBox.Game) ? result.LaunchBox.Game : [result.LaunchBox.Game];

      for (const game of games) {
        if (game.DatabaseID && game.Name && game.Platform) {
          this.gameMetadata.set(game.DatabaseID, {
            Name: game.Name,
            DatabaseID: game.DatabaseID,
            Platform: game.Platform
          });
        }
      }
      console.log(`✅ Loaded ${this.gameMetadata.size} games`);
    }

    // Load image metadata
    if (result.LaunchBox.GameImage) {
      const images = Array.isArray(result.LaunchBox.GameImage) ? result.LaunchBox.GameImage : [result.LaunchBox.GameImage];

      for (const image of images) {
        if (image.DatabaseID && image.FileName && image.Type) {
          if (!this.imageMetadata.has(image.DatabaseID)) {
            this.imageMetadata.set(image.DatabaseID, []);
          }
          this.imageMetadata.get(image.DatabaseID)!.push({
            DatabaseID: image.DatabaseID,
            FileName: image.FileName,
            Type: image.Type,
            Region: image.Region
          });
        }
      }
      console.log(`✅ Loaded images for ${this.imageMetadata.size} games`);
    }
  }

  private async loadOurGames() {
    console.log('🎮 Loading our games from Supabase...');

    const { data: games, error } = await supabase
      .from('launchbox_games')
      .select('id, name, platform_name')
      .order('id');

    if (error) {
      throw new Error(`Failed to load games: ${error.message}`);
    }

    console.log(`✅ Loaded ${games.length} games from our database`);
    return games;
  }

  private findClearLogos(): ClearLogoMatch[] {
    console.log('🔍 Finding Clear Logos in metadata...');

    const clearLogos: ClearLogoMatch[] = [];

    for (const [databaseId, images] of this.imageMetadata.entries()) {
      const clearLogoImages = images.filter(img => img.Type === 'Clear Logo');

      if (clearLogoImages.length > 0) {
        const gameData = this.gameMetadata.get(databaseId);

        if (gameData) {
          // Pick the best Clear Logo (prioritize no region, then any region)
          const bestLogo = clearLogoImages.find(img => !img.Region) || clearLogoImages[0];

          clearLogos.push({
            databaseId,
            gameName: gameData.Name,
            platform: gameData.Platform,
            imageFileName: bestLogo.FileName,
            region: bestLogo.Region
          });
        }
      }
    }

    console.log(`✅ Found ${clearLogos.length} Clear Logos in metadata`);
    return clearLogos;
  }

  private async downloadAndStoreLogos(clearLogos: ClearLogoMatch[]) {
    console.log('💾 Starting Clear Logo download and storage...');

    let successCount = 0;
    let errorCount = 0;

    for (const logo of clearLogos) {
      try {
        const imageUrl = `https://images.launchbox-app.com/${logo.imageFileName}`;

        console.log(`📥 Downloading ${logo.gameName} (${logo.platform}) - ${logo.imageFileName}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const sizeKB = Math.round(imageBuffer.byteLength / 1024);

        // Store in database
        const { error: insertError } = await supabase
          .from('clear_logos')
          .insert({
            launchbox_database_id: logo.databaseId,
            game_name: logo.gameName,
            platform_name: logo.platform,
            source_url: imageUrl,
            logo_data: base64Image,
            region: logo.region,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`❌ Database error for ${logo.gameName}: ${insertError.message}`);
          errorCount++;
          continue;
        }

        console.log(`✅ ${logo.gameName} (${logo.platform}) - ${sizeKB}KB stored successfully`);
        successCount++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error downloading ${logo.gameName}: ${error}`);
        errorCount++;
      }
    }

    console.log(`🎉 Clear Logo import completed!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total: ${clearLogos.length}`);
  }

  async run() {
    try {
      await this.loadMetadata();
      const clearLogos = this.findClearLogos();

      if (clearLogos.length === 0) {
        console.log('❌ No Clear Logos found in metadata');
        return;
      }

      console.log(`🎯 Found ${clearLogos.length} Clear Logos to download`);

      // Show some examples
      console.log('\n🎮 Sample Clear Logos found:');
      clearLogos.slice(0, 10).forEach((logo, i) => {
        console.log(`  ${i + 1}. ${logo.gameName} (${logo.platform}) ${logo.region ? `[${logo.region}]` : '[Global]'}`);
      });

      await this.downloadAndStoreLogos(clearLogos);

    } catch (error) {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    }
  }
}

// Run the scraper
const scraper = new MetadataLogoScraper();
scraper.run();