#!/usr/bin/env tsx

// Configure R2 bucket for public access to serve Clear Logo images

import { S3Client, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
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

async function configurePublicAccess() {
  console.log(`🌐 Configuring public access for R2 bucket: ${BUCKET_NAME}`);

  try {
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET_NAME}/clear-logos/*`,
        },
      ],
    };

    await r2Client.send(new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy),
    }));

    console.log('✅ Public access policy applied successfully!');
    console.log('🌐 Clear Logo images are now publicly accessible');
    console.log(`📋 Base URL: https://${process.env.VITE_CLOUDFLARE_R2_DOMAIN}/clear-logos/`);
    console.log('🎯 Example: https://${process.env.VITE_CLOUDFLARE_R2_DOMAIN}/clear-logos/a-bugs-life.webp');

  } catch (error) {
    console.error('❌ Error configuring public access:', error);
    console.log('');
    console.log('📋 Manual Configuration Required:');
    console.log('1. Go to Cloudflare Dashboard > R2 > Buckets');
    console.log(`2. Select bucket: ${BUCKET_NAME}`);
    console.log('3. Go to Settings tab');
    console.log('4. Under "Public Access", click "Allow Access"');
    console.log('5. Or set up a custom domain for better performance');
    throw error;
  }
}

configurePublicAccess().catch(console.error);