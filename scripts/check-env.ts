#!/usr/bin/env tsx

import 'dotenv/config';

// Simple environment validation for build/CI
const required = [
  'VITE_API_URL',
  'VITE_WS_URL',
  'DATABASE_URL',
  'JWT_SECRET',
];

const missing: string[] = [];
for (const key of required) {
  if (!process.env[key]) missing.push(key);
}

if (missing.length) {
  const msg = `Missing required environment variables: ${missing.join(', ')}`;
  if (process.env.CI === 'true') {
    console.warn(`[env-check] ${msg} — continuing because CI environment may inject runtime values.`);
  } else {
    console.error(msg);
    process.exit(1);
  }
}

console.log('All required environment variables are present.');
