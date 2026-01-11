#!/usr/bin/env npx tsx

import sqlite3 from 'sqlite3';
import { writeFileSync } from 'fs';

interface RecentLogo {
  id: number;
  name: string;
  platform_name: string;
  processed_at: string;
}

interface Stats {
  totalGames: number;
  gamesWithLogos: number;
  gamesWithoutLogos: number;
  completionPercentage: string;
}

// Function to get stats and recent logos from SQLite
function getLogoData(): Promise<{ stats: Stats; recentLogos: RecentLogo[] }> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('production-turbo-logos.db', (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      // Get stats
      db.get(
        'SELECT COUNT(*) as total, COUNT(logo_base64) as withLogos FROM games WHERE logo_base64 IS NOT NULL AND logo_base64 != ""',
        (err, statsRow: any) => {
          if (err) {
            console.error('Error getting stats:', err);
            db.close();
            reject(err);
            return;
          }

          const stats: Stats = {
            totalGames: 169556, // Total from Supabase
            gamesWithLogos: statsRow.withLogos || 0,
            gamesWithoutLogos: 169556 - (statsRow.withLogos || 0),
            completionPercentage: ((statsRow.withLogos || 0) / 169556 * 100).toFixed(1)
          };

          // Get recent logos with valid base64 data (excluding logo_base64 for smaller file size)
          db.all(
            `SELECT id, name, platform_name, processed_at
             FROM games
             WHERE logo_base64 IS NOT NULL AND logo_base64 != "" AND logo_base64 LIKE "data:image/%"
             ORDER BY processed_at DESC
             LIMIT 20`,
            (err, rows: any[]) => {
              db.close();

              if (err) {
                console.error('Error getting recent logos:', err);
                reject(err);
                return;
              }

              const recentLogos: RecentLogo[] = rows || [];
              resolve({ stats, recentLogos });
            }
          );
        }
      );
    });
  });
}

async function updateLogoAPIData() {
  try {
    console.log('🔄 Updating logo API data...');

    const { stats, recentLogos } = await getLogoData();

    const apiData = {
      stats,
      recentLogos,
      lastUpdate: new Date().toISOString()
    };

    // Write to public directory for frontend access
    writeFileSync('public/api/recent-logos.json', JSON.stringify(apiData, null, 2));

    console.log(`✅ Logo API data updated:`);
    console.log(`   📊 Total games: ${stats.totalGames.toLocaleString()}`);
    console.log(`   🎨 Games with logos: ${stats.gamesWithLogos.toLocaleString()}`);
    console.log(`   📈 Completion: ${stats.completionPercentage}%`);
    console.log(`   🖼️  Recent logos: ${recentLogos.length}`);

  } catch (error) {
    console.error('❌ Error updating logo API data:', error);
  }
}

// Run the update automatically
updateLogoAPIData().then(() => process.exit(0));