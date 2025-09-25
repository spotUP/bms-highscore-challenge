#!/usr/bin/env tsx

import { config } from 'dotenv';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

config();

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function listClearLogosInR2() {
  try {
    console.log('🔍 Listing clear logos in R2 bucket...\n');

    const clearLogoFiles: string[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: 'clear-logos/',
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Key.endsWith('.webp')) {
            // Extract filename without path and extension
            const fileName = object.Key.replace('clear-logos/', '').replace('.webp', '');
            clearLogoFiles.push(fileName);
          }
        }
      }

      continuationToken = response.NextContinuationToken;
      console.log(`📊 Progress: Found ${clearLogoFiles.length} clear logos so far...`);

    } while (continuationToken);

    console.log(`\n✅ Total clear logos in R2: ${clearLogoFiles.length}\n`);

    // Show sample of available logos
    console.log('📋 Sample clear logos (first 20):');
    clearLogoFiles.slice(0, 20).forEach((file, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${file}`);
    });

    if (clearLogoFiles.length > 20) {
      console.log(`... and ${clearLogoFiles.length - 20} more`);
    }

    // Save the complete list to a file for use in migration
    const fs = await import('fs/promises');
    await fs.writeFile('available-clear-logos.json', JSON.stringify(clearLogoFiles, null, 2));
    console.log(`\n💾 Complete list saved to: available-clear-logos.json`);

    return clearLogoFiles;

  } catch (error) {
    console.error('❌ Error listing R2 clear logos:', error);
    return [];
  }
}

listClearLogosInR2().catch(console.error);