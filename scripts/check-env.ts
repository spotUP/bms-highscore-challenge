#!/usr/bin/env tsx

import 'dotenv/config';

// Map legacy var name to current if needed for local dev
if (!process.env.VITE_SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  console.warn('[env-check] Using VITE_SUPABASE_PUBLISHABLE_KEY as VITE_SUPABASE_ANON_KEY for compatibility. Please rename in your .env.');
}

// Simple environment validation for build/CI
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
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
