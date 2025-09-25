#!/usr/bin/env tsx

// Empty the Cloudflare R2 bucket

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

config();

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

async function emptyBucket() {
  console.log(`🗑️ Emptying R2 bucket: ${BUCKET_NAME}`);

  let totalDeleted = 0;
  let continuationToken: string | undefined;

  do {
    try {
      // List objects in the bucket
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
      });

      const listResponse = await r2Client.send(listCommand);
      const objects = listResponse.Contents || [];

      if (objects.length === 0) {
        if (totalDeleted === 0) {
          console.log('✅ Bucket is already empty');
        }
        break;
      }

      console.log(`🔍 Found ${objects.length} objects to delete...`);

      // Delete objects in batches (max 1000 per request)
      const deleteObjects = objects.map(obj => ({ Key: obj.Key! }));

      const deleteCommand = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: deleteObjects,
        },
      });

      const deleteResponse = await r2Client.send(deleteCommand);
      const deletedCount = deleteResponse.Deleted?.length || 0;
      totalDeleted += deletedCount;

      console.log(`✅ Deleted ${deletedCount} objects (${totalDeleted} total)`);

      // Check for errors
      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        console.error('❌ Some deletions failed:');
        deleteResponse.Errors.forEach(error => {
          console.error(`   ${error.Key}: ${error.Message}`);
        });
      }

      continuationToken = listResponse.NextContinuationToken;

    } catch (error) {
      console.error('❌ Error during deletion:', error);
      break;
    }
  } while (continuationToken);

  console.log(`\n🎉 Bucket emptying completed!`);
  console.log(`📊 Total objects deleted: ${totalDeleted.toLocaleString()}`);
}

emptyBucket().catch(console.error);