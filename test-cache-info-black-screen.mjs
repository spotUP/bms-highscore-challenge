import puppeteer from 'puppeteer';
import fs from 'fs';

async function testPreset(presetPath, testName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${testName}`);
  console.log(`Preset: ${presetPath}`);
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleMessages = [];
  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);

    if (text.includes('ERROR') || text.includes('Failed') || text.includes('error')) {
      errors.push(text);
    }
  });

  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  // Temporarily modify Pong404WebGL.tsx to use the test preset
  const pongFile = '/Users/spot/Code/bms-highscore-challenge/src/pages/Pong404WebGL.tsx';
  const originalContent = fs.readFileSync(pongFile, 'utf8');
  const modifiedContent = originalContent.replace(
    /presetPath: '\/shaders\/mega-bezel\/[^']+'/,
    `presetPath: '${presetPath}'`
  );
  fs.writeFileSync(pongFile, modifiedContent);

  // Give Vite time to rebuild
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Loading game...');
  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for rendering
    console.log('Waiting 8 seconds for shader rendering...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Take screenshot to see if we get black screen
    const screenshotPath = `/tmp/test-${testName.replace(/\s+/g, '-').toLowerCase()}.jpg`;
    await page.screenshot({
      path: screenshotPath,
      type: 'jpeg',
      quality: 80,
      fullPage: false
    });
    console.log(`\nScreenshot saved: ${screenshotPath}`);

    // Check for shader bypass messages
    const bypassMessages = consoleMessages.filter(msg =>
      msg.includes('Bypassing') ||
      msg.includes('disabled') ||
      msg.includes('shadersEnabled')
    );

    // Check for compilation errors
    const compilationErrors = consoleMessages.filter(msg =>
      msg.includes('Compilation failed') ||
      msg.includes('ERROR:')
    );

    // Check for WebGL errors
    const webglErrors = consoleMessages.filter(msg =>
      msg.includes('WebGL error') ||
      msg.includes('INVALID_')
    );

    console.log('\n--- RESULTS ---');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Errors detected: ${errors.length}`);
    console.log(`Compilation errors: ${compilationErrors.length}`);
    console.log(`WebGL errors: ${webglErrors.length}`);
    console.log(`Bypass messages: ${bypassMessages.length}`);

    if (compilationErrors.length > 0) {
      console.log('\nCOMPILATION ERRORS:');
      compilationErrors.forEach(err => console.log('  ', err));
    }

    if (webglErrors.length > 0) {
      console.log('\nWEBGL ERRORS:');
      webglErrors.forEach(err => console.log('  ', err));
    }

    if (bypassMessages.length > 0) {
      console.log('\nBYPASS MESSAGES:');
      bypassMessages.forEach(msg => console.log('  ', msg));
    }

    if (errors.length > 0) {
      console.log('\nALL ERRORS:');
      errors.slice(0, 10).forEach(err => console.log('  ', err));
    }

    // Restore original file
    fs.writeFileSync(pongFile, originalContent);

  } catch (error) {
    console.error('Test failed:', error.message);
    fs.writeFileSync(pongFile, originalContent);
  }

  await browser.close();

  // Give Vite time to rebuild original
  await new Promise(resolve => setTimeout(resolve, 2000));
}

(async () => {
  console.log('\n🔬 CACHE-INFO BLACK SCREEN TEST');
  console.log('Testing two presets to isolate if cache-info-potato-params.slang causes black screen\n');

  // Test 1: WITHOUT cache-info (control - should work)
  await testPreset('/shaders/mega-bezel/test-without-cache.slangp', 'WITHOUT cache-info (control)');

  // Test 2: WITH cache-info (suspect - might cause black screen)
  await testPreset('/shaders/mega-bezel/test-with-cache.slangp', 'WITH cache-info (suspect)');

  console.log('\n\n' + '='.repeat(80));
  console.log('CONCLUSION:');
  console.log('='.repeat(80));
  console.log('Compare the two screenshots:');
  console.log('  /tmp/test-without-cache-info-(control).jpg');
  console.log('  /tmp/test-with-cache-info-(suspect).jpg');
  console.log('\nIf the "WITH cache-info" screenshot is BLACK, then cache-info-potato-params.slang');
  console.log('is confirmed to be the cause of the black screen issue.');
  console.log('='.repeat(80) + '\n');
})();
