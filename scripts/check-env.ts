#!/usr/bin/env tsx

// Simple environment validation for build/CI
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

let missing: string[] = [];
for (const key of required) {
  if (!process.env[key]) missing.push(key);
}

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('All required environment variables are present.');
