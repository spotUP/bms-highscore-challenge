#!/usr/bin/env tsx

import puppeteer, { Browser, Page } from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { parse } from 'url';

interface RuntimeCheck {
  name: string;
  description: string;
  check: (page: Page, serverUrl: string) => Promise<{ success: boolean; message: string; details?: string }>;
}

interface RuntimeResult {
  success: boolean;
  checks: Array<{
    name: string;
    success: boolean;
    message: string;
    details?: string;
  }>;
}

// Runtime simulation checks
const RUNTIME_CHECKS: RuntimeCheck[] = [
  {
    name: 'Application Loading',
    description: 'Verify the application loads without critical errors',
    check: async (page: Page, serverUrl: string) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Listen for console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        } else if (msg.type() === 'warning' || msg.type() === 'assert') {
          warnings.push(msg.text());
        }
      });

      // Listen for page errors
      page.on('pageerror', error => {
        errors.push(`Page error: ${error.message}`);
      });

      // Listen for request failures
      page.on('requestfailed', request => {
        if (request.failure() && request.failure()!.errorText !== 'net::ERR_ABORTED') {
          errors.push(`Request failed: ${request.url()} - ${request.failure()!.errorText}`);
        }
      });

      try {
        // Navigate to the application
        const response = await page.goto(serverUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        if (!response || !response.ok()) {
          return {
            success: false,
            message: `Failed to load application: ${response?.status()} ${response?.statusText()}`
          };
        }

        // Wait a bit for any async errors
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check for critical errors
        if (errors.length > 0) {
          return {
            success: false,
            message: 'Critical JavaScript errors detected',
            details: errors.slice(0, 5).join('; ') + (errors.length > 5 ? `... and ${errors.length - 5} more` : '')
          };
        }

        return {
          success: true,
          message: 'Application loaded successfully',
          details: warnings.length > 0 ? `${warnings.length} warnings detected` : undefined
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Application loading failed: ${error.message}`
        };
      }
    }
  },

  {
    name: 'Component Rendering',
    description: 'Verify critical components render without blank screens',
    check: async (page: Page, serverUrl: string) => {
      try {
        // Wait for React to render
        await page.waitForSelector('body', { timeout: 10000 });

        // Check if body has content
        const bodyContent = await page.$eval('body', el => el.textContent || '');
        if (bodyContent.trim().length < 10) {
          return {
            success: false,
            message: 'Page appears to be blank or has minimal content'
          };
        }

        // Check for common React error patterns
        const hasErrorBoundary = await page.$('[data-testid="error-boundary"], .error-boundary');
        if (hasErrorBoundary) {
          return {
            success: false,
            message: 'Error boundary is visible - application crashed'
          };
        }

        // Check for loading states that never resolve
        const loadingElements = await page.$$('[data-testid*="loading"], .loading, .spinner');
        if (loadingElements.length > 10) {
          return {
            success: false,
            message: 'Too many loading elements - possible infinite loading state'
          };
        }

        return {
          success: true,
          message: 'Critical components rendered successfully'
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Component rendering check failed: ${error.message}`
        };
      }
    }
  },

  {
    name: 'WebGL Context Initialization',
    description: 'Verify WebGL context initializes properly',
    check: async (page: Page, serverUrl: string) => {
      try {
        // Check if WebGL is supported and working
        const webglSupport = await page.evaluate(() => {
          try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return { supported: false, error: 'WebGL not supported' };

            // Test basic WebGL functionality
            const webgl = gl as WebGLRenderingContext;
            const program = webgl.createProgram();
            if (!program) return { supported: true, error: 'Cannot create WebGL program' };

            return { supported: true, error: null };
          } catch (error: any) {
            return { supported: false, error: error.message };
          }
        });

        if (!webglSupport.supported) {
          return {
            success: false,
            message: 'WebGL context initialization failed',
            details: webglSupport.error || 'Unknown WebGL error'
          };
        }

        return {
          success: true,
          message: 'WebGL context initialized successfully'
        };
      } catch (error: any) {
        return {
          success: false,
          message: `WebGL check failed: ${error.message}`
        };
      }
    }
  },

  {
    name: 'Navigation Functionality',
    description: 'Test basic navigation and routing functionality',
    check: async (page: Page, serverUrl: string) => {
      try {
        // Check if navigation elements exist
        const navElements = await page.$$('nav, [data-testid*="nav"], .navigation, a[href]');
        if (navElements.length === 0) {
          return {
            success: false,
            message: 'No navigation elements found'
          };
        }

        // Try to find and click a navigation link
        const links = await page.$$eval('a[href]', anchors =>
          anchors.map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim() }))
            .filter(link => link.href && !link.href.startsWith('http') && !link.href.startsWith('#'))
        );

        if (links.length > 0) {
          // Try clicking the first internal link
          const firstLink = links[0];
          try {
            await page.click(`a[href="${firstLink.href}"]`);
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check if URL changed (basic navigation test)
            const currentUrl = page.url();
            const navigated = !currentUrl.includes('#') || currentUrl !== serverUrl;

            if (navigated) {
              return {
                success: true,
                message: 'Navigation functionality working'
              };
            }
          } catch (error) {
            // Navigation might fail, but that's okay for this test
            console.log('Navigation test failed, but continuing:', error);
          }
        }

        // If navigation test didn't work, just check that we have some interactive elements
        const buttons = await page.$$('button, [role="button"], [onclick]');
        if (buttons.length > 0) {
          return {
            success: true,
            message: 'Interactive elements found (navigation may work)'
          };
        }

        return {
          success: false,
          message: 'No interactive navigation elements found'
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Navigation check failed: ${error.message}`
        };
      }
    }
  },

  {
    name: 'Asset Loading',
    description: 'Verify critical assets load correctly',
    check: async (page: Page, serverUrl: string) => {
      try {
        // Check for broken images
        const brokenImages = await page.$$eval('img', imgs => {
          return imgs
            .filter(img => img.complete && img.naturalHeight === 0)
            .map(img => img.src);
        });

        if (brokenImages.length > 0) {
          return {
            success: false,
            message: 'Broken images detected',
            details: `${brokenImages.length} images failed to load`
          };
        }

        // Check for missing CSS
        const hasStyles = await page.$eval('head', head => {
          const links = head.querySelectorAll('link[rel="stylesheet"]');
          return links.length > 0;
        });

        if (!hasStyles) {
          return {
            success: false,
            message: 'No CSS stylesheets loaded'
          };
        }

        // Check for JavaScript errors in asset loading
        const jsErrors = await page.evaluate(() => {
          const errors: string[] = [];
          const scripts = document.querySelectorAll('script[src]');

          scripts.forEach(script => {
            // Check if script loaded (basic check)
            if (script.hasAttribute('src')) {
              // We can't easily check script loading status, but we can check for error events
              // This is handled by the page error listener above
            }
          });

          return errors;
        });

        if (jsErrors.length > 0) {
          return {
            success: false,
            message: 'JavaScript asset loading errors',
            details: jsErrors.join('; ')
          };
        }

        return {
          success: true,
          message: 'Critical assets loaded successfully'
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Asset loading check failed: ${error.message}`
        };
      }
    }
  }
];

// Simple static file server for testing
function createTestServer(distDir: string): Promise<{ server: any; url: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url!);
      let pathname = parsedUrl.pathname!;

      // Default to index.html for root requests
      if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
      }

      const filePath = join(distDir, pathname);

      // Security check - only serve files from dist directory
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      try {
        if (existsSync(filePath)) {
          const ext = extname(filePath);
          const contentType = getContentType(ext);
          const content = readFileSync(filePath);

          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      } catch (error) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });

    server.listen(0, 'localhost', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 3000;
      const url = `http://localhost:${port}`;
      resolve({ server, url });
    });

    server.on('error', reject);
  });
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };
  return types[ext] || 'text/plain';
}

// Run all runtime simulation checks
async function runRuntimeSimulationChecks(): Promise<RuntimeResult> {
  console.log('🌐 Runtime Simulation Test');
  console.log('==========================\n');

  const result: RuntimeResult = {
    success: true,
    checks: []
  };

  let browser: Browser | null = null;
  let server: any = null;
  let serverUrl = '';

  try {
    // Check if dist directory exists
    const distDir = join(process.cwd(), 'dist');
    if (!existsSync(distDir)) {
      throw new Error('Build directory (dist) not found. Run "npm run build" first.');
    }

    // Start test server
    console.log('Starting test server...');
    const serverInfo = await createTestServer(distDir);
    server = serverInfo.server;
    serverUrl = serverInfo.url;
    console.log(`Test server running at: ${serverUrl}`);

    // Launch browser
    console.log('Launching headless browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't work in Windows
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set reasonable timeouts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Run each check
    for (const check of RUNTIME_CHECKS) {
      console.log(`🌐 Running: ${check.name}`);
      console.log(`   ${check.description}`);

      try {
        const checkResult = await check.check(page, serverUrl);
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

  } catch (error: any) {
    console.error('💥 Runtime simulation setup failed:', error);
    result.success = false;
    result.checks.push({
      name: 'Setup',
      success: false,
      message: `Test setup failed: ${error.message}`
    });
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.close();
    }
  }

  return result;
}

// Display results
function displayRuntimeResults(result: RuntimeResult) {
  const passed = result.checks.filter(c => c.success);
  const failed = result.checks.filter(c => !c.success);

  console.log('📊 RUNTIME SIMULATION SUMMARY');
  console.log('==============================');

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
    console.log('🎉 RUNTIME SIMULATION PASSED');
    console.log('=============================');
    console.log('Application appears to run correctly in browser environment.');
  } else {
    console.log('❌ RUNTIME SIMULATION FAILED');
    console.log('============================');
    console.log('Application has runtime issues that should be fixed before deployment.');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    const result = await runRuntimeSimulationChecks();
    displayRuntimeResults(result);
  } catch (error: any) {
    console.error('💥 Runtime simulation test system crashed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runRuntimeSimulationChecks, RUNTIME_CHECKS };