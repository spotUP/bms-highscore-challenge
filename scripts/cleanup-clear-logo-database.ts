#!/usr/bin/env tsx

// Clean up Clear Logo database by removing niche/obscure platforms
// This reduces the database size significantly

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Platforms to remove (niche/obscure systems)
const PLATFORMS_TO_REMOVE = [
  '3DO Interactive Multiplayer',
  'APF Imagination Machine',
  'Aamber Pegasus',
  'Acorn Archimedes',
  'Acorn Atom',
  'Acorn Electron',
  'Amstrad CPC',
  'Amstrad GX4000',
  'Android',
  'Apogee BK-01',
  'Apple II',
  'Apple IIGS',
  'Apple Mac OS',
  'Apple iOS',
  'Atari 2600',
  'Atari 5200',
  'Atari 7800',
  'Atari 800',
  'Atari XEGS',
  'BBC Microcomputer System',
  'Camputers Lynx',
  'Casio Loopy',
  'Casio PV-1000',
  'Coleco ADAM',
  'ColecoVision',
  'Commodore 128',
  'Commodore MAX Machine',
  'Commodore PET',
  'Commodore Plus 4',
  'Commodore VIC-20',
  'Dragon 32/64',
  'EACA EG2000 Colour Genie',
  'Elektronika BK',
  'Emerson Arcadia 2001',
  'Enterprise',
  'Entex Adventure Vision',
  'Epoch Game Pocket Computer',
  'Epoch Super Cassette Vision',
  'Exelvision EXL 100',
  'Fairchild Channel F',
  'Funtech Super Acan',
  'GCE Vectrex',
  'GamePark GP32',
  'Hartung Game Master',
  'Hector HRX',
  'Interton VC 4000',
  'Jupiter Ace',
  'Linux',
  'MS-DOS',
  'Magnavox Odyssey',
  'Magnavox Odyssey 2',
  'Matra and Hachette Alice',
  'Mattel Aquarius',
  'Mattel HyperScan',
  'Mattel Intellivision',
  'Mega Duck',
  'Memotech MTX512',
  'Microsoft MSX',
  'Microsoft MSX2',
  'Microsoft MSX2+',
  'Microsoft Xbox',
  'Microsoft Xbox 360',
  'Microsoft Xbox One',
  'NEC PC-8801',
  'NEC PC-9801',
  'Nokia N-Gage',
  'Nuon',
  'Oric Atmos',
  'Ouya',
  'Philips CD-i',
  'Philips Videopac+',
  'RCA Studio II',
  'ScummVM',
  'Sega Pico',
  'Sharp X1',
  'Sinclair ZX-81',
  'Sony PSP Minis',
  'Sord M5',
  'TRS-80 Color Computer',
  'Tandy TRS-80',
  'Texas Instruments TI 99/4A',
  'Tiger Game.com',
  'Tomy Tutor',
  'VTech CreatiVision',
  'VTech Socrates',
  'Watara Supervision',
  'Web Browser',
  'Windows 3.X',
  'ZiNc',
  // Additional platforms to remove for size constraints
  'Windows',
  'Microsoft Xbox',
  'Microsoft Xbox 360',
  'Microsoft Xbox One',
  'Sony Playstation 3',
  'Sony Playstation 4',
  // Remove more to get under 10GB
  'Commodore 64',
  'Commodore Amiga',
  'Sinclair ZX Spectrum',
  // Additional removal to fit 10GB
  'Sony Playstation',
  'Sony Playstation 2'
];

async function cleanupClearLogoDatabase() {
  console.log('🧹 Starting Clear Logo database cleanup...');

  const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Clear Logo database not found at: ${dbPath}`);
    return;
  }

  // Get current size
  const beforeStats = fs.statSync(dbPath);
  const beforeSizeMB = (beforeStats.size / 1024 / 1024).toFixed(1);
  console.log(`📊 Database size before cleanup: ${beforeSizeMB}MB`);

  const db = new Database(dbPath);

  // Get counts before cleanup
  const totalBefore = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
  console.log(`📊 Clear Logos before cleanup: ${totalBefore.count.toLocaleString()}`);

  // Show platform counts that will be removed
  console.log('🗂️ Platforms to be removed:');
  for (const platform of PLATFORMS_TO_REMOVE) {
    const count = db.prepare('SELECT COUNT(*) as count FROM clear_logos WHERE platform_name = ?').get(platform) as { count: number };
    if (count.count > 0) {
      console.log(`   ${platform}: ${count.count.toLocaleString()} logos`);
    }
  }

  // Remove niche platforms
  console.log('');
  console.log('🗑️ Removing niche platforms...');

  const placeholders = PLATFORMS_TO_REMOVE.map(() => '?').join(',');
  const deleteResult = db.prepare(`
    DELETE FROM clear_logos
    WHERE platform_name IN (${placeholders})
  `).run(...PLATFORMS_TO_REMOVE);

  console.log(`✅ Removed ${deleteResult.changes.toLocaleString()} Clear Logo entries`);

  // Get counts after cleanup
  const totalAfter = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
  console.log(`📊 Clear Logos after cleanup: ${totalAfter.count.toLocaleString()}`);

  // Show remaining platforms
  console.log('');
  console.log('🎯 Remaining mainstream platforms:');
  const remainingPlatforms = db.prepare(`
    SELECT platform_name, COUNT(*) as count
    FROM clear_logos
    GROUP BY platform_name
    ORDER BY count DESC
  `).all() as Array<{ platform_name: string; count: number }>;

  remainingPlatforms.forEach(({ platform_name, count }) => {
    console.log(`   ${platform_name}: ${count.toLocaleString()} logos`);
  });

  // Vacuum to reclaim space
  console.log('');
  console.log('♻️ Optimizing database...');
  db.pragma('vacuum');
  console.log('✅ Database optimized');

  db.close();

  // Get final size
  const afterStats = fs.statSync(dbPath);
  const afterSizeMB = (afterStats.size / 1024 / 1024).toFixed(1);
  const savedMB = (beforeSizeMB as any) - (afterSizeMB as any);

  console.log('');
  console.log('🎉 Database cleanup completed!');
  console.log(`📊 Database size after cleanup: ${afterSizeMB}MB`);
  console.log(`💾 Space saved: ${savedMB.toFixed(1)}MB`);
  console.log(`📈 Reduction: ${((savedMB / (beforeSizeMB as any)) * 100).toFixed(1)}%`);
  console.log('');
  console.log('💡 Benefits:');
  console.log('   ✅ Focused on mainstream gaming platforms');
  console.log('   ✅ Reduced storage requirements');
  console.log('   ✅ Faster uploads to Cloudflare R2');
  console.log('   ✅ Better user experience with relevant content');
}

// Run the cleanup
cleanupClearLogoDatabase().catch(console.error);