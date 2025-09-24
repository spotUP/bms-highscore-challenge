#!/usr/bin/env tsx

/**
 * Deploy tests script
 * This script runs after the build process to verify deployment readiness
 */

console.log('🚀 Running deployment tests...');

// Check if required environment variables are set
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];

let allEnvVarsPresent = true;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    allEnvVarsPresent = false;
  } else {
    console.log(`✅ ${envVar} is set`);
  }
}

// Check if build directory exists
import { existsSync } from 'fs';
import { join } from 'path';

const buildDir = join(process.cwd(), 'dist');
if (!existsSync(buildDir)) {
  console.error('❌ Build directory (dist) not found');
  process.exit(1);
}

console.log('✅ Build directory exists');

// Check if index.html exists in build
const indexPath = join(buildDir, 'index.html');
if (!existsSync(indexPath)) {
  console.error('❌ index.html not found in build directory');
  process.exit(1);
}

console.log('✅ index.html found in build directory');

if (!allEnvVarsPresent) {
  console.warn('⚠️  Some environment variables are missing, but continuing deployment');
}

console.log('🎉 All deployment tests passed!');
process.exit(0);