#!/usr/bin/env tsx

import { config } from 'dotenv';

config();

const R2_DOMAIN = process.env.VITE_CLOUDFLARE_R2_DOMAIN!;

async function listClearLogosViaProxy() {
  try {
    console.log('🔍 Checking clear logos via proxy server...\n');
    console.log(`Using R2 domain: ${R2_DOMAIN}`);

    // Since we can't directly list R2 bucket contents via HTTP, let's try a different approach
    // Check if we have any local files that contain the logo list
    const fs = await import('fs/promises');
    const path = await import('path');

    // Look for any existing logo databases or manifests
    const filesToCheck = [
      './turbo-logos.db',
      './production-turbo-logos.db',
      './available-clear-logos.json'
    ];

    for (const filePath of filesToCheck) {
      try {
        const stats = await fs.stat(filePath);
        console.log(`📁 Found: ${filePath} (${Math.round(stats.size / 1024)}KB)`);

        if (filePath.endsWith('.db')) {
          // SQLite database - let's check its contents
          const Database = (await import('better-sqlite3')).default;
          const db = new Database(filePath, { readonly: true });

          try {
            // Try different possible table/column names
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            console.log(`   Tables: ${tables.map((t: any) => t.name).join(', ')}`);

            for (const table of tables) {
              try {
                const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as any;
                console.log(`   ${table.name}: ${count.count} rows`);

                // Sample a few rows to see structure
                const sample = db.prepare(`SELECT * FROM ${table.name} LIMIT 3`).all();
                if (sample.length > 0) {
                  console.log(`   Sample columns: ${Object.keys(sample[0]).join(', ')}`);
                }
              } catch (e) {
                // Ignore table access errors
              }
            }
          } catch (e) {
            console.log(`   Unable to read database contents: ${e}`);
          } finally {
            db.close();
          }
        }
      } catch (error) {
        // File doesn't exist, continue
      }
    }

    // Alternative approach: Test some known game names to see what's available
    console.log('\n🎯 Testing availability for some sample games...');

    const sampleGames = [
      'pac-man',
      'mario-bros',
      'sonic-the-hedgehog',
      'street-fighter',
      'tetris',
      'donkey-kong',
      'galaga',
      'centipede'
    ];

    const availableLogos = [];

    for (const game of sampleGames) {
      const logoUrl = `https://${R2_DOMAIN}/clear-logos/${game}.webp`;
      try {
        const response = await fetch(logoUrl, { method: 'HEAD' });
        const status = response.status === 200 ? '✅' : '❌';
        console.log(`   ${game}: ${status} (${response.status})`);
        if (response.status === 200) {
          availableLogos.push(game);
        }
      } catch (error) {
        console.log(`   ${game}: ❌ (error)`);
      }
    }

    console.log(`\n📊 Found ${availableLogos.length} available logos from sample`);

    if (availableLogos.length > 0) {
      console.log('✅ Clear logos are available in R2 bucket');
    } else {
      console.log('⚠️  No clear logos found in sample - bucket might be empty or inaccessible');
    }

    return availableLogos;

  } catch (error) {
    console.error('❌ Error checking clear logos:', error);
    return [];
  }
}

listClearLogosViaProxy().catch(console.error);