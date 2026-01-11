#!/usr/bin/env tsx

import { config } from 'dotenv';

config();

const R2_DOMAIN = process.env.VITE_CLOUDFLARE_R2_DOMAIN!;

function createSafeFileName(gameName: string): string {
  return gameName
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

async function listAllLogos() {
  try {
    console.log('🔍 Discovering all available logos in R2 bucket...\n');

    // Read the games from SQLite to get all game names
    const Database = (await import('better-sqlite3')).default;
    const db = new Database('public/games.db', { readonly: true });

    const allGames = db.prepare(`
      SELECT DISTINCT name 
      FROM games 
      ORDER BY name
    `).all();

    console.log(`📊 Testing ${allGames.length} unique game names...`);

    const availableLogos: string[] = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < allGames.length; i += BATCH_SIZE) {
      const batch = allGames.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (game: any) => {
        const safeFileName = createSafeFileName(game.name);
        const logoUrl = `https://${R2_DOMAIN}/clear-logos/${safeFileName}.webp`;

        try {
          const response = await fetch(logoUrl, { method: 'HEAD' });
          if (response.status === 200) {
            return game.name;
          }
        } catch (error) {
          // Logo not available
        }
        return null;
      });

      const results = await Promise.all(promises);
      const foundLogos = results.filter(name => name !== null);
      availableLogos.push(...foundLogos);

      const progress = ((i + batch.length) / allGames.length * 100).toFixed(1);
      console.log(`📈 Progress: ${i + batch.length}/${allGames.length} tested (${progress}%) - Found: ${availableLogos.length} logos`);

      // Small delay to be nice to the server
      if (i + BATCH_SIZE < allGames.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    db.close();

    console.log(`\n✅ Logo discovery completed!`);
    console.log(`📊 Found ${availableLogos.length} games with available logos`);

    // Save the list to a file
    const fs = await import('fs/promises');
    await fs.writeFile(
      'available-logos-list.json',
      JSON.stringify(availableLogos, null, 2)
    );

    console.log(`💾 Logo list saved to: available-logos-list.json`);

    // Show sample
    console.log('\n🎮 Sample games with logos:');
    availableLogos.slice(0, 20).forEach((name, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${name}`);
    });

    return availableLogos;

  } catch (error) {
    console.error('❌ Error listing logos:', error);
    return [];
  }
}

listAllLogos().catch(console.error);
