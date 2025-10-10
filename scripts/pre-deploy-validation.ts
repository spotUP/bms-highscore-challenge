#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

interface ValidationCheck {
  name: string;
  description: string;
  required: boolean;
  check: () => Promise<{ success: boolean; message: string; details?: string }>;
}

interface ValidationResult {
  success: boolean;
  checks: Array<{
    name: string;
    success: boolean;
    message: string;
    details?: string;
    required: boolean;
  }>;
}

// Comprehensive pre-deployment validation checks
const VALIDATION_CHECKS: ValidationCheck[] = [
  {
    name: 'Environment Variables',
    description: 'Validate all required environment variables are present and valid',
    required: true,
    check: async () => {
      const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
      const missing = required.filter(key => !process.env[key]);

      if (missing.length > 0) {
        return {
          success: false,
          message: `Missing required environment variables: ${missing.join(', ')}`,
          details: 'Set these variables in your deployment environment or .env file'
        };
      }

      // Validate URL format
      const url = process.env.VITE_SUPABASE_URL!;
      try {
        const parsedUrl = new URL(url);
        if (!parsedUrl.protocol.startsWith('https')) {
          return {
            success: false,
            message: 'VITE_SUPABASE_URL must use HTTPS protocol',
            details: `Current: ${url}`
          };
        }
      } catch {
        return {
          success: false,
          message: 'VITE_SUPABASE_URL is not a valid URL',
          details: `Current: ${url}`
        };
      }

      return { success: true, message: 'All required environment variables are present and valid' };
    }
  },

  {
    name: 'Supabase Connectivity',
    description: 'Test connection to Supabase database',
    required: true,
    check: async () => {
      try {
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.VITE_SUPABASE_ANON_KEY!,
          {
            auth: { persistSession: false },
            global: { headers: { 'X-Client-Info': 'pre-deploy-validation' } }
          }
        );

        // Test basic connectivity with a simple query
        const { error } = await supabase.from('profiles').select('count').limit(1).single();

        if (error) {
          // Check if it's expected permission error for anon key
          if (error.code === 'PGRST116' || error.message.includes('permission denied')) {
            return { success: true, message: 'Supabase connection successful (permissions as expected)' };
          }
          return {
            success: false,
            message: `Supabase query failed: ${error.message}`,
            details: `Error code: ${error.code}`
          };
        }

        return { success: true, message: 'Supabase connection and basic query successful' };
      } catch (error: any) {
        return {
          success: false,
          message: `Supabase connection error: ${error.message}`,
          details: 'Check your internet connection and Supabase service status'
        };
      }
    }
  },

  {
    name: 'WebSocket Server',
    description: 'Check WebSocket server availability',
    required: false,
    check: async () => {
      const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;

      try {
        // Try to connect to WebSocket server health endpoint with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`http://localhost:${port}/health`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'pre-deploy-validation' }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            message: `WebSocket server responding on port ${port}`,
            details: `Instance: ${data.serverInstanceId}, Players: ${data.players}, Rooms: ${data.rooms}`
          };
        } else {
          return {
            success: false,
            message: `WebSocket server health check failed (HTTP ${response.status})`,
            details: `Port: ${port}`
          };
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            message: `WebSocket server health check timed out`,
            details: `Port: ${port} (timeout after 5 seconds)`
          };
        }
        return {
          success: false,
          message: `Cannot connect to WebSocket server on port ${port}`,
          details: error.message
        };
      }
    }
  },

  {
    name: 'Build Artifacts',
    description: 'Verify production build exists and is recent',
    required: true,
    check: async () => {
      const distDir = join(process.cwd(), 'dist');

      if (!existsSync(distDir)) {
        return {
          success: false,
          message: 'Production build directory does not exist',
          details: 'Run "npm run build" to create the production build'
        };
      }

      // Check for essential files
      const essentialFiles = [
        'index.html'
      ];

      const missingFiles: string[] = [];
      for (const file of essentialFiles) {
        if (!existsSync(join(distDir, file))) {
          missingFiles.push(file);
        }
      }

      // Check for assets directory and some asset files
      const assetsDir = join(distDir, 'assets');
      if (!existsSync(assetsDir)) {
        missingFiles.push('assets/ directory');
      } else {
        // Check if there are any JS and CSS files in assets
        const assetFiles = readdirSync(assetsDir);
        const hasJs = assetFiles.some(f => f.endsWith('.js'));
        const hasCss = assetFiles.some(f => f.endsWith('.css'));

        if (!hasJs) missingFiles.push('assets/*.js files');
        if (!hasCss) missingFiles.push('assets/*.css files');
      }

      if (missingFiles.length > 0) {
        return {
          success: false,
          message: `Missing essential build files: ${missingFiles.join(', ')}`,
          details: 'Rebuild the project with "npm run build"'
        };
      }

      // Check build freshness (should be less than 24 hours old for deployment)
      const indexPath = join(distDir, 'index.html');
      const stats = statSync(indexPath);
      const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

      if (ageHours > 24) {
        return {
          success: false,
          message: `Build is ${ageHours.toFixed(1)} hours old`,
          details: 'Rebuild with "npm run build" for deployment'
        };
      }

      return {
        success: true,
        message: 'Build artifacts are present and recent',
        details: `Build age: ${ageHours.toFixed(1)} hours`
      };
    }
  },

  {
    name: 'Configuration Consistency',
    description: 'Check configuration files for consistency',
    required: false,
    check: async () => {
      const issues: string[] = [];

      // Check package.json
      try {
        const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

        if (!packageJson.name || !packageJson.version) {
          issues.push('package.json missing name or version');
        }

        // Check for required scripts
        const requiredScripts = ['build', 'dev', 'websocket'];
        for (const script of requiredScripts) {
          if (!packageJson.scripts?.[script]) {
            issues.push(`Missing script: ${script}`);
          }
        }
      } catch {
        issues.push('Invalid package.json');
      }

      // Check vite.config.ts
      if (!existsSync('vite.config.ts')) {
        issues.push('Missing vite.config.ts');
      }

      if (issues.length > 0) {
        return {
          success: false,
          message: 'Configuration issues found',
          details: issues.join(', ')
        };
      }

      return { success: true, message: 'Configuration files are consistent' };
    }
  },

  {
    name: 'Dependencies',
    description: 'Verify all dependencies are installed',
    required: true,
    check: async () => {
      try {
        // Check if node_modules exists
        if (!existsSync('node_modules')) {
          return {
            success: false,
            message: 'node_modules directory not found',
            details: 'Run "npm install" to install dependencies'
          };
        }

        // Try to import a key dependency to verify installation
        await import('@supabase/supabase-js');

        return { success: true, message: 'Dependencies are properly installed' };
      } catch (error: any) {
        return {
          success: false,
          message: 'Dependency installation issue',
          details: error.message
        };
      }
    }
  },

  {
    name: 'TypeScript Compilation',
    description: 'Verify TypeScript compiles without errors',
    required: false,
    check: async () => {
      try {
        execSync('npx tsc --noEmit', { stdio: 'pipe' });
        return { success: true, message: 'TypeScript compilation successful' };
      } catch (error: any) {
        return {
          success: false,
          message: 'TypeScript compilation failed',
          details: error.stdout?.toString() || error.message
        };
      }
    }
  }
];

// Run all validation checks
async function runValidation(): Promise<ValidationResult> {
  console.log('🚀 Pre-Deployment Validation System');
  console.log('====================================\n');

  const result: ValidationResult = {
    success: true,
    checks: []
  };

  for (const check of VALIDATION_CHECKS) {
    console.log(`🔍 Running: ${check.name}`);
    console.log(`   ${check.description}`);

    try {
      const checkResult = await check.check();
      result.checks.push({
        name: check.name,
        success: checkResult.success,
        message: checkResult.message,
        details: checkResult.details,
        required: check.required
      });

      if (checkResult.success) {
        console.log(`   ✅ ${checkResult.message}`);
        if (checkResult.details) {
          console.log(`      ${checkResult.details}`);
        }
      } else {
        console.log(`   ❌ ${checkResult.message}`);
        if (checkResult.details) {
          console.log(`      ${checkResult.details}`);
        }

        if (check.required) {
          result.success = false;
        }
      }
    } catch (error: any) {
      result.checks.push({
        name: check.name,
        success: false,
        message: `Check failed with error: ${error.message}`,
        required: check.required
      });

      console.log(`   💥 ${check.name} failed: ${error.message}`);

      if (check.required) {
        result.success = false;
      }
    }

    console.log('');
  }

  return result;
}

// Display final results
function displayResults(result: ValidationResult) {
  const passed = result.checks.filter(c => c.success);
  const failed = result.checks.filter(c => !c.success);
  const requiredFailed = failed.filter(c => c.required);

  console.log('📊 VALIDATION SUMMARY');
  console.log('=====================');

  if (passed.length > 0) {
    console.log(`✅ Passed: ${passed.length}`);
    passed.forEach(check => {
      console.log(`   • ${check.name}`);
    });
  }

  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}`);
    failed.forEach(check => {
      console.log(`   • ${check.name}: ${check.message}`);
      if (check.details) {
        console.log(`     ${check.details}`);
      }
    });
  }

  console.log('');

  if (result.success) {
    console.log('🎉 ALL VALIDATIONS PASSED');
    console.log('========================');
    console.log('Your application is ready for deployment!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Push your changes to your repository');
    console.log('2. Deploy using your preferred platform (Vercel, Netlify, etc.)');
    console.log('3. Monitor the deployment logs for any runtime issues');
  } else {
    console.log('❌ DEPLOYMENT BLOCKED');
    console.log('===================');
    console.log('Fix the failed required checks before deploying.');

    if (requiredFailed.length > 0) {
      console.log('');
      console.log('Required checks that failed:');
      requiredFailed.forEach(check => {
        console.log(`• ${check.name}`);
      });
    }

    console.log('');
    console.log('💡 Common fixes:');
    console.log('• Run "npm install" to install dependencies');
    console.log('• Run "npm run build" to create production build');
    console.log('• Check your .env file has all required variables');
    console.log('• Ensure Supabase is accessible and not paused');
    console.log('• Start the WebSocket server with "npm run websocket"');

    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    const result = await runValidation();
    displayResults(result);
  } catch (error: any) {
    console.error('💥 Validation system crashed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runValidation, VALIDATION_CHECKS };