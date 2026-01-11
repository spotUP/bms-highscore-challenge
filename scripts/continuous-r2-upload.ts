#!/usr/bin/env tsx

// Continuous upload script that runs during import to keep uploading new logos
// This runs in a loop, checking for new logos and uploading them to R2

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

async function continuousR2Upload() {
  console.log('🔄 Starting continuous R2 upload process...');

  // Check environment variables
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'retroranks-logos';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('❌ Missing required environment variables for R2 upload');
    return;
  }

  // Configure R2 client
  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log(`📦 Using bucket: ${bucketName}`);

  const dbPath = path.join(process.cwd(), 'public', 'clear-logos.db');
  let uploadedCount = 0;
  let totalSizeBytes = 0;
  let lastUploadedId = 0;

  while (true) {
    try {
      // Check if database exists
      if (!fs.existsSync(dbPath)) {
        console.log('⏳ Waiting for Clear Logo database to be created...');
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        continue;
      }

      const db = new Database(dbPath);

      // Get count of new logos since last upload
      const newLogosCount = db.prepare('SELECT COUNT(*) as count FROM clear_logos WHERE id > ?').get(lastUploadedId) as { count: number };

      if (newLogosCount.count === 0) {
        console.log(`⏳ No new logos since last upload (${uploadedCount} total uploaded), waiting...`);
        db.close();
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        continue;
      }

      console.log(`🆕 Found ${newLogosCount.count} new logos to upload`);

      // Get new logos in batches
      const BATCH_SIZE = 25;
      const newLogos = db.prepare(`
        SELECT * FROM clear_logos
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `).all(lastUploadedId, BATCH_SIZE) as ClearLogo[];

      db.close();

      if (newLogos.length === 0) {
        continue;
      }

      console.log(`📦 Processing batch of ${newLogos.length} new logos...`);

      // Upload each new logo
      for (const logo of newLogos) {
        try {
          // Convert game name to safe filename
          const safeFileName = logo.game_name
            .replace(/[^a-zA-Z0-9\-_\s]/g, '') // Remove special chars
            .replace(/\s+/g, '-') // Replace spaces with dashes
            .toLowerCase();

          const key = `clear-logos/${safeFileName}.webp`;

          // Convert base64 to Buffer
          const imageBuffer = Buffer.from(logo.logo_base64, 'base64');
          totalSizeBytes += imageBuffer.length;

          // Upload to R2
          await r2Client.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: key,
              Body: imageBuffer,
              ContentType: 'image/webp',
              Metadata: {
                'game-name': logo.game_name,
                'platform': logo.platform_name,
                'launchbox-id': logo.launchbox_database_id.toString(),
              },
            })
          );

          uploadedCount++;
          lastUploadedId = logo.id;

          if (uploadedCount % 50 === 0) {
            console.log(`✅ Uploaded ${uploadedCount.toLocaleString()} logos total (${Math.round(totalSizeBytes / 1024 / 1024)}MB)`);
          }

        } catch (error) {
          console.error(`❌ Failed to upload ${logo.game_name}:`, error);
        }
      }

      console.log(`🎯 Batch completed. Total uploaded: ${uploadedCount.toLocaleString()}`);

    } catch (error) {
      console.error('❌ Error in continuous upload:', error);
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute on error
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping continuous R2 upload...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping continuous R2 upload...');
  process.exit(0);
});

// Run the continuous upload
continuousR2Upload().catch(console.error);