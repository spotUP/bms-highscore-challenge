#!/usr/bin/env tsx

// Upload popular Clear Logo images to Cloudflare R2 storage
// This script uploads only the most popular games to stay within 10GB free tier

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

// Load environment variables
config();

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

// Popular game franchises/names to prioritize
const POPULAR_GAMES = [
  'mario', 'sonic', 'zelda', 'pokemon', 'street fighter', 'tekken', 'mortal kombat',
  'final fantasy', 'dragon quest', 'metal gear', 'resident evil', 'silent hill',
  'grand theft auto', 'call of duty', 'halo', 'gears of war', 'forza', 'fifa',
  'madden', 'nba', 'wwe', 'tony hawk', 'guitar hero', 'rock band', 'dance dance',
  'pac-man', 'galaga', 'centipede', 'asteroids', 'space invaders', 'frogger',
  'donkey kong', 'king of fighters', 'samurai shodown', 'guilty gear', 'blazblue',
  'crash bandicoot', 'spyro', 'ratchet', 'jak', 'sly cooper', 'god of war',
  'tomb raider', 'hitman', 'splinter cell', 'rainbow six', 'ghost recon',
  'battlefield', 'medal of honor', 'doom', 'quake', 'half-life', 'portal',
  'bioshock', 'fallout', 'elder scrolls', 'mass effect', 'dragon age',
  'assassin\'s creed', 'prince of persia', 'rayman', 'far cry', 'watch dogs'
];

async function uploadPopularLogosToR2() {
  console.log('🚀 Starting Popular Clear Logo upload to Cloudflare R2...');

  // Check environment variables
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'retroranks-logos';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   CLOUDFLARE_ACCOUNT_ID');
    console.error('   CLOUDFLARE_R2_ACCESS_KEY_ID');
    console.error('   CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    return;
  }

  // Configure R2 client (S3-compatible)
  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log(`📦 Using bucket: ${bucketName}`);

  // Open the Clear Logo database
  const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Clear Logo database not found at: ${dbPath}`);
    return;
  }

  const db = new Database(dbPath);

  // Build query for popular games
  const popularConditions = POPULAR_GAMES.map(() => 'game_name LIKE ?').join(' OR ');
  const popularParams = POPULAR_GAMES.map(game => `%${game}%`);

  // Get popular logos first
  const popularLogos = db.prepare(`
    SELECT * FROM clear_logos
    WHERE ${popularConditions}
    ORDER BY game_name
    LIMIT 30000
  `).all(...popularParams) as ClearLogo[];

  console.log(`🎯 Found ${popularLogos.length.toLocaleString()} popular Clear Logos`);

  // Estimate size and adjust limit if needed
  const ESTIMATED_SIZE_PER_LOGO = 150 * 1024; // 150KB average
  const MAX_SIZE_BYTES = 8 * 1024 * 1024 * 1024; // 8GB (leaving 2GB buffer)
  const maxLogos = Math.floor(MAX_SIZE_BYTES / ESTIMATED_SIZE_PER_LOGO);

  const logosToUpload = popularLogos.slice(0, Math.min(maxLogos, popularLogos.length));
  console.log(`📊 Uploading ${logosToUpload.length.toLocaleString()} logos (estimated ${Math.round(logosToUpload.length * ESTIMATED_SIZE_PER_LOGO / 1024 / 1024 / 1024 * 10) / 10}GB)`);

  // Process in batches
  const BATCH_SIZE = 50;
  let uploadedCount = 0;
  let errorCount = 0;
  let totalSizeBytes = 0;

  for (let i = 0; i < logosToUpload.length; i += BATCH_SIZE) {
    const batch = logosToUpload.slice(i, i + BATCH_SIZE);

    console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(logosToUpload.length / BATCH_SIZE)} (${batch.length} logos)`);

    // Upload each logo in the batch
    for (const logo of batch) {
      try {
        // Convert game name to safe filename
        const safeFileName = logo.game_name
          .replace(/[^a-zA-Z0-9\-_\s]/g, '') // Remove special chars
          .replace(/\s+/g, '-') // Replace spaces with dashes
          .toLowerCase();

        const key = `clear-logos/${safeFileName}.png`;

        // Convert base64 to Buffer
        const imageBuffer = Buffer.from(logo.logo_base64, 'base64');
        totalSizeBytes += imageBuffer.length;

        // Check if we're approaching the size limit
        if (totalSizeBytes > MAX_SIZE_BYTES) {
          console.log(`⚠️ Approaching size limit (${Math.round(totalSizeBytes / 1024 / 1024 / 1024 * 10) / 10}GB), stopping upload`);
          break;
        }

        // Upload to R2
        await r2Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: imageBuffer,
            ContentType: 'image/png',
            Metadata: {
              'game-name': logo.game_name,
              'platform': logo.platform_name,
              'launchbox-id': logo.launchbox_database_id.toString(),
            },
          })
        );

        uploadedCount++;
        if (uploadedCount % 100 === 0) {
          console.log(`✅ Uploaded ${uploadedCount.toLocaleString()} logos (${Math.round(totalSizeBytes / 1024 / 1024 / 1024 * 10) / 10}GB)...`);
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to upload ${logo.game_name}:`, error);
      }
    }

    // Stop if we hit size limit
    if (totalSizeBytes > MAX_SIZE_BYTES) {
      break;
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  db.close();

  console.log('');
  console.log('🎉 Popular Clear Logo upload completed!');
  console.log(`✅ Successfully uploaded: ${uploadedCount.toLocaleString()} logos`);
  console.log(`📊 Total size: ${Math.round(totalSizeBytes / 1024 / 1024 / 1024 * 10) / 10}GB`);
  console.log(`❌ Failed uploads: ${errorCount.toLocaleString()} logos`);
  console.log('');
  console.log('💡 To use Clear Logos in your app:');
  console.log(`   1. VITE_CLOUDFLARE_R2_DOMAIN is already configured`);
  console.log('   2. Clear Logos will be available at: https://your-domain.com/clear-logos/game-name.png');
}

// Run the upload
uploadPopularLogosToR2().catch(console.error);