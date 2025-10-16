import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  console.log('\n🧪 TESTING MEGA BEZEL CRT SHADERS\n');

  const browser = await puppeteer.launch({ headless: false }); // Set to true for headless
  const page = await browser.newPage();

  const consoleMessages = [];
  const errors = [];

  page.on('console', msg => {
    consoleMessages.push(msg.text());
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  try {
    console.log('📂 Opening http://localhost:8080/404...');
    await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('⏳ Waiting 15 seconds for shader compilation...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check compilation status
    const compiled = consoleMessages.filter(m => m.includes('Program pass_') && m.includes('compiled successfully'));
    const failed = consoleMessages.filter(m => m.includes('compilation failed') || m.includes('Failed to compile'));

    console.log('\n=== COMPILATION RESULTS ===\n');

    if (failed.length > 0) {
      console.log(`❌ ${failed.length} SHADER FAILURES:`);
      failed.forEach(f => console.log(`  - ${f}`));
    } else {
      console.log('✅ NO SHADER COMPILATION FAILURES');
    }

    console.log(`\n✅ Successfully compiled: ${compiled.length}/17 shader passes`);

    if (compiled.length === 17) {
      console.log('\n🎉 ALL 17 MEGA BEZEL PASSES COMPILED!\n');
    } else {
      console.log(`\n⚠️  Only ${compiled.length}/17 passes compiled\n`);
    }

    // Check for runtime errors
    const runtimeErrors = errors.filter(e => !e.includes('AudioContext'));
    if (runtimeErrors.length > 0) {
      console.log(`❌ ${runtimeErrors.length} RUNTIME ERRORS:`);
      runtimeErrors.slice(0, 5).forEach(e => console.log(`  - ${e.substring(0, 150)}`));
    } else {
      console.log('✅ NO RUNTIME ERRORS (excluding AudioContext)');
    }

    // Take screenshot
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({
      path: 'shader-test-screenshot.jpeg',
      type: 'jpeg',
      quality: 90,
      fullPage: false
    });
    console.log('✅ Screenshot saved: shader-test-screenshot.jpeg');

    // Check if shaders are actually active
    const shadersActive = consoleMessages.some(m =>
      m.includes('Shader pipeline initialized') ||
      m.includes('shadersEnabled = true')
    );

    console.log(`\n🎨 Shaders active in renderer: ${shadersActive ? '✅ YES' : '❌ NO'}`);

    console.log('\n=== TEST COMPLETE ===\n');
    console.log('Next steps:');
    console.log('  1. Check shader-test-screenshot.jpeg to see visual output');
    console.log('  2. Open http://localhost:8080/404 in your browser to see live rendering');
    console.log('  3. Press F12 to open DevTools and check console for any issues\n');

    // Keep browser open for 5 seconds so you can see it
    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
  } finally {
    await browser.close();
  }
})();
