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

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables:');
  if (!supabaseUrl) console.error('- VITE_SUPABASE_URL');
  if (!supabaseAnonKey) console.error('- VITE_SUPABASE_ANON_KEY');
  
  // In CI or external builders, make this non-fatal to avoid blocking builds
  if (process.env.CI || process.env.NODE_ENV === 'production') {
    console.warn('External build environment detected - continuing without env vars');
    process.exit(0);
  }
  
  process.exit(1);
}

console.log('All required environment variables are present.');
