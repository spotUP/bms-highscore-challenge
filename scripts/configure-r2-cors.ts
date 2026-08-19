#!/usr/bin/env tsx

// Configure CORS settings for Cloudflare R2 bucket to allow webapp access

import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
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

async function configureR2Cors() {
  console.log(`🌐 Configuring CORS for R2 bucket: ${BUCKET_NAME}`);

  try {
    const corsConfiguration = {
      CORSRules: [
        {
          ID: 'AllowWebAppAccess',
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'HEAD'],
          // Only hosts this project actually serves from. Wildcards over
          // shared hosting (*.netlify.app, *.vercel.app) let anyone's
          // deployment read this bucket from a visitor's browser.
          AllowedOrigins: [
            'https://retroranks.uprough.net',
            'http://localhost:8081',
            'http://127.0.0.1:8081'
          ],
          ExposeHeaders: [
            'ETag',
            'x-amz-meta-game-name',
            'x-amz-meta-platform',
            'x-amz-meta-launchbox-id'
          ],
          MaxAgeSeconds: 3600
        }
      ]
    };

    await r2Client.send(new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: corsConfiguration
    }));

    console.log('✅ CORS configuration applied successfully!');
    console.log('🌐 Allowed origins:');
    corsConfiguration.CORSRules[0].AllowedOrigins.forEach(origin => {
      console.log(`   - ${origin}`);
    });
    console.log('🔧 Allowed methods: GET, HEAD');
    console.log('📋 Allowed headers: * (all)');
    console.log('⏱️ Max age: 3600 seconds (1 hour)');

  } catch (error) {
    console.error('❌ Error configuring CORS:', error);
    throw error;
  }
}

configureR2Cors().catch(console.error);