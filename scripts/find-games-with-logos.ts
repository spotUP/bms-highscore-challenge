#!/usr/bin/env tsx

import { config } from 'dotenv';
import Database from 'better-sqlite3';

config();

const R2_DOMAIN = process.env.VITE_CLOUDFLARE_R2_DOMAIN!;

// Logo downloader's approved platforms filter
const APPROVED_PLATFORMS = [
  'Arcade', 'Atari Jaguar', 'Atari Jaguar CD', 'Atari Lynx', 'Bandai WonderSwan',
  'Bandai WonderSwan Color', 'Commodore 64', 'Commodore Amiga', 'Commodore Amiga CD32',
  'DOS', 'Microsoft Xbox', 'Microsoft Xbox 360', 'Microsoft Xbox One', 'NEC PC Engine',
  'NEC PC Engine CD', 'NEC PC-FX', 'NEC TurboGrafx-16', 'NEC TurboGrafx-CD', 'Nintendo 3DS',
  'Nintendo 64', 'Nintendo DS', 'Nintendo Entertainment System', 'Nintendo Famicom Disk System',
  'Nintendo Game Boy', 'Nintendo Game Boy Advance', 'Nintendo Game Boy Color', 'Nintendo GameCube',
  'Nintendo Switch', 'Nintendo Wii', 'Nintendo Wii U', 'Panasonic 3DO', 'Philips CD-i', 'ScummVM',
  'Sega 32X', 'Sega CD', 'Sega Dreamcast', 'Sega Game Gear', 'Sega Genesis', 'Sega Master System',
  'Sega Model 2', 'Sega Saturn', 'SNK Neo Geo', 'SNK Neo Geo CD', 'SNK Neo Geo Pocket',
  'SNK Neo Geo Pocket Color', 'Sony PlayStation', 'Sony PlayStation 2', 'Sony PlayStation 3',
  'Sony PlayStation 4', 'Sony PlayStation 5', 'Sony PlayStation Portable', 'Sony PlayStation Vita',
  'Super Nintendo Entertainment System', 'Amstrad CPC', 'Atari 2600', 'Atari 5200', 'Atari 7800',
  'Atari 8-bit', 'Atari ST', 'Magnavox Odyssey 2', 'Mattel Intellivision', 'MSX', 'MSX2',
  'Sinclair ZX Spectrum'
];

function createSafeFileName(gameName: string): string {
  return gameName
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

async function findGamesWithLogos() {
  try {
    console.log('🔍 Finding games from approved platforms that have clear logos in R2...\n');

    // Open SQLite database
    const db = new Database('public/games.db', { readonly: true });

    // Get filtered games from SQLite
    const placeholders = APPROVED_PLATFORMS.map(() => '?').join(',');
    const query = `
      SELECT id, name, platform_name, logo_base64, launchbox_id
      FROM games
      WHERE platform_name IN (${placeholders})
      ORDER BY platform_name, name
      LIMIT 1000
    `;

    const allGames = db.prepare(query).all(...APPROVED_PLATFORMS);
    console.log(`📊 Found ${allGames.length} games from approved platforms`);

    // Test logos in batches to avoid overwhelming the server
    const BATCH_SIZE = 50;
    const gamesWithLogos: any[] = [];
    let tested = 0;

    console.log('🎯 Testing logo availability...\n');

    for (let i = 0; i < allGames.length; i += BATCH_SIZE) {
      const batch = allGames.slice(i, i + BATCH_SIZE);

      // Test this batch
      const promises = batch.map(async (game) => {
        const safeFileName = createSafeFileName(game.name);
        const logoUrl = `https://${R2_DOMAIN}/clear-logos/${safeFileName}.webp`;

        try {
          const response = await fetch(logoUrl, { method: 'HEAD' });
          if (response.status === 200) {
            return { ...game, logoUrl, safeFileName };
          }
        } catch (error) {
          // Logo not available
        }
        return null;
      });

      const results = await Promise.all(promises);
      const foundLogos = results.filter(result => result !== null);
      gamesWithLogos.push(...foundLogos);

      tested += batch.length;
      const progress = ((tested / allGames.length) * 100).toFixed(1);
      console.log(`📈 Progress: ${tested}/${allGames.length} games tested (${progress}%) - Found: ${gamesWithLogos.length} logos`);

      // Small delay to be nice to the server
      if (i + BATCH_SIZE < allGames.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    db.close();

    console.log(`\n✅ Logo testing completed!`);
    console.log(`📊 Games with available logos: ${gamesWithLogos.length} out of ${allGames.length} tested`);
    console.log(`📈 Logo coverage: ${((gamesWithLogos.length / allGames.length) * 100).toFixed(1)}%`);

    // Show platform breakdown
    const platformCounts: Record<string, number> = {};
    gamesWithLogos.forEach(game => {
      platformCounts[game.platform_name] = (platformCounts[game.platform_name] || 0) + 1;
    });

    console.log('\n📋 Games with logos by platform:');
    Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([platform, count]) => {
        console.log(`   ${platform}: ${count} games`);
      });

    // Save results
    const fs = await import('fs/promises');
    await fs.writeFile(
      'games-with-logos.json',
      JSON.stringify(gamesWithLogos, null, 2)
    );
    console.log(`\n💾 Results saved to: games-with-logos.json`);

    // Show sample games
    console.log('\n🎮 Sample games with logos:');
    gamesWithLogos.slice(0, 10).forEach((game, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${game.name} (${game.platform_name})`);
    });

    return gamesWithLogos;

  } catch (error) {
    console.error('❌ Error finding games with logos:', error);
    return [];
  }
}

findGamesWithLogos().catch(console.error);