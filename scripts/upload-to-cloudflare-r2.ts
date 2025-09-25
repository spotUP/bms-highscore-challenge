#!/usr/bin/env tsx

// Upload Clear Logo images to Cloudflare R2 storage
// This script uploads all Clear Logo images from the SQLite database to R2

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

async function uploadClearLogosToR2() {
  console.log('🚀 Starting Clear Logo upload to Cloudflare R2...');

  // Check environment variables
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'retroranks-clear-logos';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   CLOUDFLARE_ACCOUNT_ID');
    console.error('   CLOUDFLARE_R2_ACCESS_KEY_ID');
    console.error('   CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    console.error('');
    console.error('💡 Set these up in your Cloudflare dashboard:');
    console.error('   1. Go to R2 Object Storage');
    console.error('   2. Create a bucket');
    console.error('   3. Create API tokens with R2 permissions');
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
    console.error('💡 Run the Clear Logo importer first to create the database');
    return;
  }

  const db = new Database(dbPath);

  // Get total count
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM clear_logos').get() as { count: number };
  console.log(`📊 Found ${totalResult.count.toLocaleString()} Clear Logos to upload`);

  // Process in batches
  const BATCH_SIZE = 100;
  let uploadedCount = 0;
  let errorCount = 0;

  for (let offset = 0; offset < totalResult.count; offset += BATCH_SIZE) {
    const batch = db.prepare(`
      SELECT * FROM clear_logos
      ORDER BY id
      LIMIT ? OFFSET ?
    `).all(BATCH_SIZE, offset) as ClearLogo[];

    console.log(`📦 Processing batch ${Math.floor(offset / BATCH_SIZE) + 1}/${Math.ceil(totalResult.count / BATCH_SIZE)} (${batch.length} logos)`);

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
        if (uploadedCount % 50 === 0) {
          console.log(`✅ Uploaded ${uploadedCount.toLocaleString()} logos...`);
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to upload ${logo.game_name}:`, error);
      }
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  db.close();

  console.log('');
  console.log('🎉 Upload completed!');
  console.log(`✅ Successfully uploaded: ${uploadedCount.toLocaleString()} logos`);
  console.log(`❌ Failed uploads: ${errorCount.toLocaleString()} logos`);
  console.log('');
  console.log('💡 To use Clear Logos in your app:');
  console.log(`   1. Set VITE_CLOUDFLARE_R2_DOMAIN to your R2 bucket domain`);
  console.log(`   2. Example: VITE_CLOUDFLARE_R2_DOMAIN=${bucketName}.${accountId}.r2.cloudflarestorage.com`);
  console.log('   3. Clear Logos will be available at: https://your-domain.com/clear-logos/game-name.png');
}

// Run the upload
uploadClearLogosToR2().catch(console.error);