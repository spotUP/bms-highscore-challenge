#!/usr/bin/env tsx

// Export Clear Logo database to static JSON files for Vercel deployment
// Creates smaller JSON chunks that can be served as static files

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

interface ClearLogo {
  id: number;
  launchbox_database_id: number;
  game_name: string;
  platform_name: string;
  source_url: string;
  logo_base64: string;
  region?: string;
  created_at: string;
}

interface LogoIndex {
  [gameName: string]: {
    chunkFile: string;
    logoId: string;
    platform?: string;
    region?: string;
  };
}

async function exportClearLogosToJSON() {
  console.log('🔄 Exporting Clear Logos to static JSON files for Vercel...');

  const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
  const outputDir = path.join(process.cwd(), 'public', 'clear-logos');

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Clear Logo database not found at:', dbPath);
    return;
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const db = new Database(dbPath, { readonly: true });

  try {
    // Get total count
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
    console.log(`📊 Processing ${totalResult.count.toLocaleString()} Clear Logos`);

    // Small chunk size for faster loading (50 logos per chunk = ~5-10MB each)
    const CHUNK_SIZE = 50;
    const totalChunks = Math.ceil(totalResult.count / CHUNK_SIZE);

    console.log(`📦 Creating ${totalChunks} JSON chunks of ${CHUNK_SIZE} logos each`);

    const logoIndex: LogoIndex = {};
    let processedCount = 0;

    // Process in chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const offset = chunkIndex * CHUNK_SIZE;
      const chunkFile = `chunk-${chunkIndex.toString().padStart(4, '0')}.json`;

      console.log(`📦 Creating chunk ${chunkIndex + 1}/${totalChunks} (${chunkFile})`);

      // Get logos for this chunk (prefer Global region)
      const logos = db.prepare(`
        SELECT id, launchbox_database_id, game_name, platform_name,
               source_url, logo_base64, region, created_at
        FROM clear_logos
        ORDER BY
          CASE WHEN region IS NULL THEN 0 ELSE 1 END,
          game_name,
          id
        LIMIT ? OFFSET ?
      `).all(CHUNK_SIZE, offset) as ClearLogo[];

      if (logos.length === 0) {
        console.log(`⏩ No logos in chunk ${chunkIndex + 1}, stopping`);
        break;
      }

      // Create chunk data
      const chunkData: { [logoId: string]: string } = {};

      for (const logo of logos) {
        const logoId = `${logo.game_name}|||${logo.platform_name}`.toLowerCase();

        // Add to chunk data
        chunkData[logoId] = logo.logo_base64;

        // Add to index (only if not already present or this is Global region)
        if (!logoIndex[logo.game_name] || !logo.region) {
          logoIndex[logo.game_name] = {
            chunkFile,
            logoId,
            platform: logo.platform_name,
            region: logo.region
          };
        }

        processedCount++;
      }

      // Write chunk file
      const chunkPath = path.join(outputDir, chunkFile);
      fs.writeFileSync(chunkPath, JSON.stringify(chunkData, null, 2));

      const chunkStats = fs.statSync(chunkPath);
      const chunkSizeMB = (chunkStats.size / 1024 / 1024).toFixed(1);
      console.log(`✅ Chunk ${chunkIndex + 1} created: ${chunkSizeMB}MB (${logos.length} logos)`);
    }

    // Create game name index
    const indexPath = path.join(outputDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(logoIndex, null, 2));

    // Create manifest with metadata
    const manifest = {
      totalLogos: processedCount,
      totalChunks: Math.ceil(processedCount / CHUNK_SIZE),
      chunkSize: CHUNK_SIZE,
      lastUpdated: new Date().toISOString(),
      format: 'Each chunk contains logoId -> base64 mapping',
      usage: 'Load index.json first, then fetch individual chunk files as needed'
    };

    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`\n🎉 Clear Logo export completed!`);
    console.log(`📁 Output directory: ${outputDir}`);
    console.log(`📊 Total logos exported: ${processedCount.toLocaleString()}`);
    console.log(`📦 Total JSON files: ${Math.ceil(processedCount / CHUNK_SIZE) + 2} (chunks + index + manifest)`);
    console.log(`💾 Average chunk size: ~5-10MB`);

    // Calculate total size
    const totalSize = fs.readdirSync(outputDir)
      .filter(file => file.endsWith('.json'))
      .reduce((total, file) => {
        const stats = fs.statSync(path.join(outputDir, file));
        return total + stats.size;
      }, 0);

    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(1);
    console.log(`💽 Total export size: ${totalSizeMB}MB`);

    console.log(`\n📋 Usage:`);
    console.log(`   1. Load /clear-logos/manifest.json for metadata`);
    console.log(`   2. Load /clear-logos/index.json to find games`);
    console.log(`   3. Load individual chunk files as needed`);

  } catch (error) {
    console.error('❌ Error during export:', error);
  } finally {
    db.close();
  }
}

// Run export if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exportClearLogosToJSON().catch(console.error);
}

export { exportClearLogosToJSON };