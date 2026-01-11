#!/usr/bin/env tsx

// Upload mainstream Clear Logo images to Cloudflare R2 storage
// Database has already been cleaned, so we upload all remaining logos

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

async function uploadMainstreamLogosToR2() {
  console.log('🚀 Starting Mainstream Clear Logo upload to Cloudflare R2...');

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

  // Get count first
  const totalCount = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
  console.log(`🎯 Found ${totalCount.count.toLocaleString()} total Clear Logos`);

  // Show platform breakdown
  const platformBreakdown = db.prepare(`
    SELECT platform_name, COUNT(*) as count
    FROM clear_logos
    GROUP BY platform_name
    ORDER BY count DESC
  `).all() as { platform_name: string; count: number }[];

  console.log('📊 Platforms included:');
  platformBreakdown.forEach(({ platform_name, count }) => {
    console.log(`   ${platform_name}: ${count.toLocaleString()} logos`);
  });

  // Estimate size and adjust limit if needed
  const ESTIMATED_SIZE_PER_LOGO = 150 * 1024; // 150KB average
  const MAX_SIZE_BYTES = 8 * 1024 * 1024 * 1024; // 8GB (leaving 2GB buffer)
  const maxLogos = Math.floor(MAX_SIZE_BYTES / ESTIMATED_SIZE_PER_LOGO);

  const totalLogos = Math.min(maxLogos, totalCount.count);
  console.log(`📊 Uploading up to ${totalLogos.toLocaleString()} logos (estimated ${Math.round(totalLogos * ESTIMATED_SIZE_PER_LOGO / 1024 / 1024 / 1024 * 10) / 10}GB)`);

  // Process in batches from database
  const BATCH_SIZE = 50;
  let uploadedCount = 0;
  let errorCount = 0;
  let totalSizeBytes = 0;
  let offset = 0;

  const stmt = db.prepare(`
    SELECT * FROM clear_logos
    ORDER BY platform_name, game_name
    LIMIT ? OFFSET ?
  `);

  while (offset < totalLogos) {
    const batch = stmt.all(BATCH_SIZE, offset) as ClearLogo[];
    if (batch.length === 0) break;

    console.log(`📦 Processing batch ${Math.floor(offset / BATCH_SIZE) + 1} (${batch.length} logos, offset ${offset})`);

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

        // If it's a bucket error, stop the process
        if (error instanceof Error && error.message.includes('NoSuchBucket')) {
          console.error('💡 Create the bucket in Cloudflare R2 dashboard first!');
          break;
        }
      }
    }

    offset += BATCH_SIZE;

    // Stop if we hit size limit or bucket error
    if (totalSizeBytes > MAX_SIZE_BYTES) {
      break;
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  db.close();

  console.log('');
  console.log('🎉 Mainstream Clear Logo upload completed!');
  console.log(`✅ Successfully uploaded: ${uploadedCount.toLocaleString()} logos`);
  console.log(`📊 Total size: ${Math.round(totalSizeBytes / 1024 / 1024 / 1024 * 10) / 10}GB`);
  console.log(`❌ Failed uploads: ${errorCount.toLocaleString()} logos`);
  console.log('');
  console.log('💡 Top platforms included in upload:');
  platformBreakdown.slice(0, 10).forEach(({ platform_name, count }) => {
    console.log(`   ${platform_name}: ${count.toLocaleString()} logos`);
  });
}

// Run the upload
uploadMainstreamLogosToR2().catch(console.error);