#!/usr/bin/env tsx

// Import Commodore 64 and Commodore Amiga Clear Logos from LaunchBox API
// This restores platforms that were removed without permission

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface Platform {
  ID: number;
  Name: string;
}

interface Game {
  ID: number;
  Name: string;
  Platform: string;
}

interface ClearLogo {
  ID: number;
  DatabaseID: number;
  Type: string;
  FileName: string;
  CRC32: string;
}

// Target platforms to import
const TARGET_PLATFORMS = ['Commodore 64', 'Commodore Amiga'];

async function importCommodoreClearLogos() {
  console.log('🎯 Starting targeted platform Clear Logo import...');

  const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Clear Logo database not found at: ${dbPath}`);
    return;
  }

  const db = new Database(dbPath);

  // Get current count
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
  console.log(`📊 Current Clear Logos: ${currentCount.count.toLocaleString()}`);

  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO clear_logos (
      launchbox_database_id, game_name, platform_name, source_url, logo_base64, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  let totalImported = 0;

  for (const platformName of TARGET_PLATFORMS) {
    console.log(`\n🔍 Importing ${platformName} Clear Logos...`);

    try {
      // Get platform ID from LaunchBox
      console.log('📡 Fetching platform data...');
      const platformResponse = await fetch('https://gamesdb.launchbox-app.com/platforms.json');
      if (!platformResponse.ok) {
        throw new Error(`Failed to fetch platforms: ${platformResponse.statusText}`);
      }

      const platformsData = await platformResponse.json();
      const platform = platformsData.find((p: Platform) => p.Name === platformName);

      if (!platform) {
        console.log(`⚠️ Platform ${platformName} not found in LaunchBox API`);
        continue;
      }

      console.log(`📡 Fetching games for ${platformName}...`);
      const gamesResponse = await fetch(`https://gamesdb.launchbox-app.com/games.json?platform=${encodeURIComponent(platformName)}`);
      if (!gamesResponse.ok) {
        throw new Error(`Failed to fetch games for ${platformName}: ${gamesResponse.statusText}`);
      }

      const gamesData = await gamesResponse.json();
      console.log(`🎮 Found ${gamesData.length} games for ${platformName}`);

      // Get Clear Logos for this platform
      console.log(`📡 Fetching Clear Logos for ${platformName}...`);
      const clearLogosResponse = await fetch(`https://gamesdb.launchbox-app.com/images/clearlogos.json?platform=${encodeURIComponent(platformName)}`);

      if (!clearLogosResponse.ok) {
        console.log(`⚠️ No Clear Logo data found for ${platformName}`);
        continue;
      }

      const clearLogosData = await clearLogosResponse.json();
      console.log(`🖼️ Found ${clearLogosData.length} Clear Logos for ${platformName}`);

      let platformImported = 0;

      // Process logos sequentially to handle async operations
      for (const logo of clearLogosData) {
        try {
          // Find the corresponding game
          const game = gamesData.find((g: Game) => g.ID === logo.DatabaseID);
          if (!game) {
            continue;
          }

          // Construct the image URL
          const imageUrl = `https://images.launchbox-app.com/${logo.FileName}`;

          // Download and encode the image
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            continue;
          }

          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');

          // Insert into database
          const result = insertStmt.run(
            logo.DatabaseID,
            game.Name,
            platformName,
            imageUrl,
            base64Image,
            new Date().toISOString()
          );

          if (result.changes > 0) {
            platformImported++;
          }

        } catch (error) {
          console.log(`⚠️ Failed to process logo for game ID ${logo.DatabaseID}:`, error);
        }
      }

      console.log(`✅ Imported ${platformImported} Clear Logos for ${platformName}`);
      totalImported += platformImported;

      // Small delay between platforms
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Error importing ${platformName}:`, error);
    }
  }

  // Get final count
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };

  db.close();

  console.log('\n🎉 Commodore Clear Logo import completed!');
  console.log(`✅ Total imported: ${totalImported.toLocaleString()} Clear Logos`);
  console.log(`📊 Before: ${currentCount.count.toLocaleString()} logos`);
  console.log(`📊 After: ${finalCount.count.toLocaleString()} logos`);
  console.log(`📈 Net increase: ${(finalCount.count - currentCount.count).toLocaleString()} logos`);
}

// Run the import
importCommodoreClearLogos().catch(console.error);