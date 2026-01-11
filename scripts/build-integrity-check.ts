#!/usr/bin/env tsx

import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

interface BuildCheck {
  name: string;
  description: string;
  check: () => Promise<{ success: boolean; message: string; details?: string }>;
}

interface BuildResult {
  success: boolean;
  checks: Array<{
    name: string;
    success: boolean;
    message: string;
    details?: string;
  }>;
}

// Comprehensive build integrity checks
const BUILD_CHECKS: BuildCheck[] = [
  {
    name: 'Build Directory Existence',
    description: 'Verify dist directory exists and contains build artifacts',
    check: async () => {
      const distDir = join(process.cwd(), 'dist');

      if (!existsSync(distDir)) {
        return {
          success: false,
          message: 'Build directory (dist) not found',
          details: 'Run "npm run build" to create the production build'
        };
      }

      const files = readdirSync(distDir);
      if (files.length === 0) {
        return {
          success: false,
          message: 'Build directory is empty',
          details: 'Build process may have failed'
        };
      }

      return {
        success: true,
        message: `Build directory exists with ${files.length} files`
      };
    }
  },

  {
    name: 'Required Files Presence',
    description: 'Check for all required files in build output',
    check: async () => {
      const distDir = join(process.cwd(), 'dist');
      const requiredFiles = [
        'index.html',
        'assets/index-*.css',
        'assets/index-*.js'
      ];

      const missingFiles: string[] = [];
      const warnings: string[] = [];

      for (const pattern of requiredFiles) {
        if (pattern.includes('*')) {
          // Handle glob patterns
          const [dir, filePattern] = pattern.split('/');
          const searchDir = dir ? join(distDir, dir) : distDir;
          const ext = filePattern.split('-')[0] === 'index' ? filePattern.split('.')[1] : '';

          if (existsSync(searchDir)) {
            const files = readdirSync(searchDir);
            const matchingFiles = files.filter(f =>
              f.startsWith('index-') && f.endsWith(`.${ext}`)
            );

            if (matchingFiles.length === 0) {
              missingFiles.push(pattern);
            } else if (matchingFiles.length > 1) {
              warnings.push(`Multiple ${pattern} files found`);
            }
          } else {
            missingFiles.push(pattern);
          }
        } else {
          // Direct file check
          if (!existsSync(join(distDir, pattern))) {
            missingFiles.push(pattern);
          }
        }
      }

      if (missingFiles.length > 0) {
        return {
          success: false,
          message: `Missing required files: ${missingFiles.join(', ')}`,
          details: 'Rebuild the project with "npm run build"'
        };
      }

      const message = warnings.length > 0
        ? `All required files present (${warnings.join(', ')})`
        : 'All required files present';

      return {
        success: true,
        message,
        details: warnings.length > 0 ? warnings.join('; ') : undefined
      };
    }
  },

  {
    name: 'File Size Validation',
    description: 'Check that build files have reasonable sizes (not empty/corrupted)',
    check: async () => {
      const distDir = join(process.cwd(), 'dist');
      const issues: string[] = [];

      // Check index.html
      const indexPath = join(distDir, 'index.html');
      if (existsSync(indexPath)) {
        const size = statSync(indexPath).size;
        if (size < 500) { // Less than 500 bytes is suspicious for a real HTML file
          issues.push(`index.html too small (${size} bytes)`);
        }
      }

      // Check assets
      const assetsDir = join(distDir, 'assets');
      if (existsSync(assetsDir)) {
        const assetFiles = readdirSync(assetsDir);

        for (const file of assetFiles) {
          const filePath = join(assetsDir, file);
          const size = statSync(filePath).size;

          if (size === 0) {
            issues.push(`${file} is empty (0 bytes)`);
          } else if (size < 100 && extname(file) === '.js') {
            issues.push(`${file} suspiciously small (${size} bytes)`);
          } else if (size < 50 && extname(file) === '.css') {
            issues.push(`${file} suspiciously small (${size} bytes)`);
          }
        }

        // Check for reasonable total asset size
        const totalAssetSize = assetFiles.reduce((total, file) => {
          return total + statSync(join(assetsDir, file)).size;
        }, 0);

        if (totalAssetSize < 100000) { // Less than 100KB total is suspicious
          issues.push(`Total assets size too small (${(totalAssetSize / 1024).toFixed(1)}KB)`);
        }
      }

      if (issues.length > 0) {
        return {
          success: false,
          message: 'File size issues detected',
          details: issues.join('; ')
        };
      }

      return {
        success: true,
        message: 'All files have reasonable sizes'
      };
    }
  },

  {
    name: 'Critical Assets Loading',
    description: 'Verify critical assets are properly referenced and accessible',
    check: async () => {
      const distDir = join(process.cwd(), 'dist');
      const indexPath = join(distDir, 'index.html');

      if (!existsSync(indexPath)) {
        return {
          success: false,
          message: 'Cannot check assets loading - index.html missing'
        };
      }

      const indexContent = readFileSync(indexPath, 'utf8');
      const issues: string[] = [];

      // Check for CSS and JS references
      const cssMatches = indexContent.match(/href="([^"]*\.css)"/g);
      const jsMatches = indexContent.match(/src="([^"]*\.js)"/g);

      // Verify referenced files exist
      if (cssMatches) {
        for (const match of cssMatches) {
          const href = match.match(/href="([^"]*\.css)"/)?.[1];
          if (href && !href.startsWith('http')) {
            const cssPath = join(distDir, href);
            if (!existsSync(cssPath)) {
              issues.push(`Referenced CSS file missing: ${href}`);
            }
          }
        }
      }

      if (jsMatches) {
        for (const match of jsMatches) {
          const src = match.match(/src="([^"]*\.js)"/)?.[1];
          if (src && !src.startsWith('http')) {
            const jsPath = join(distDir, src);
            if (!existsSync(jsPath)) {
              issues.push(`Referenced JS file missing: ${src}`);
            }
          }
        }
      }

      // Check for basic HTML structure
      if (!indexContent.includes('<html') || !indexContent.includes('<head') || !indexContent.includes('<body')) {
        issues.push('HTML structure incomplete');
      }

      if (issues.length > 0) {
        return {
          success: false,
          message: 'Critical assets loading issues',
          details: issues.join('; ')
        };
      }

      return {
        success: true,
        message: 'Critical assets properly referenced and accessible'
      };
    }
  },

  {
    name: 'Console Error Check',
    description: 'Check for console errors in build output (if available)',
    check: async () => {
      // This is a basic check - more comprehensive checking would require build logs
      // For now, we'll check if there are any obvious error indicators in the build

      try {
        // Try to run a quick syntax check on JS files
        const distDir = join(process.cwd(), 'dist');
        const assetsDir = join(distDir, 'assets');

        if (existsSync(assetsDir)) {
          const jsFiles = readdirSync(assetsDir).filter(f => f.endsWith('.js'));

          for (const jsFile of jsFiles) {
            const jsPath = join(assetsDir, jsFile);
            const content = readFileSync(jsPath, 'utf8');

            // Basic syntax check - look for obvious issues
              if (content.includes('undefined is not a function') ||
                  content.includes('Cannot read property') ||
                  content.includes('SyntaxError') ||
                  content.includes('ReferenceError')) {
                return {
                  success: false,
                  message: `Potential error detected in ${jsFile}`,
                  details: 'Build may contain runtime errors'
                };
              }
          }
        }

        return {
          success: true,
          message: 'No obvious console errors detected in build output'
        };
      } catch (error: any) {
        return {
          success: false,
          message: 'Error checking build output',
          details: error.message
        };
      }
    }
  }
];

// Run all build integrity checks
async function runBuildIntegrityChecks(): Promise<BuildResult> {
  console.log('🔍 Build Integrity Verification');
  console.log('===============================\n');

  const result: BuildResult = {
    success: true,
    checks: []
  };

  for (const check of BUILD_CHECKS) {
    console.log(`🔍 Running: ${check.name}`);
    console.log(`   ${check.description}`);

    try {
      const checkResult = await check.check();
      result.checks.push({
        name: check.name,
        success: checkResult.success,
        message: checkResult.message,
        details: checkResult.details
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
        result.success = false;
      }
    } catch (error: any) {
      result.checks.push({
        name: check.name,
        success: false,
        message: `Check failed with error: ${error.message}`
      });

      console.log(`   💥 ${check.name} failed: ${error.message}`);
      result.success = false;
    }

    console.log('');
  }

  return result;
}

// Display results
function displayBuildResults(result: BuildResult) {
  const passed = result.checks.filter(c => c.success);
  const failed = result.checks.filter(c => !c.success);

  console.log('📊 BUILD INTEGRITY SUMMARY');
  console.log('==========================');

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
    console.log('🎉 BUILD INTEGRITY VERIFIED');
    console.log('===========================');
    console.log('Build artifacts appear to be valid and complete.');
  } else {
    console.log('❌ BUILD INTEGRITY ISSUES DETECTED');
    console.log('==================================');
    console.log('Fix the failed checks before proceeding with deployment.');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    const result = await runBuildIntegrityChecks();
    displayBuildResults(result);
  } catch (error: any) {
    console.error('💥 Build integrity check system crashed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runBuildIntegrityChecks, BUILD_CHECKS };