import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Track shader compilation
  let paramsModified = 0;
  let crtEffectStatus = 'unknown';

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('Modified') && text.includes('parameter defaults')) {
      const match = text.match(/Modified (\d+) parameter/);
      if (match) paramsModified += parseInt(match[1]);
    }

    if (text.includes('CRT EFFECT:')) {
      crtEffectStatus = text;
      console.log('📺', text);
    }
  });

  console.log('🎮 Testing Mega Bezel CRT shader with parameter injection...\n');

  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('⏳ Waiting for initial load...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Press spacebar to start game
    console.log('🎯 Starting game...');
    await page.keyboard.press(' ');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Enable CRT effect
    console.log('🔧 Enabling CRT shader (pressing C)...');
    await page.keyboard.press('c');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot during gameplay
    await page.screenshot({
      path: '/tmp/claude/crt-gameplay-test.jpeg',
      type: 'jpeg',
      quality: 90,
      fullPage: false
    });

    console.log('\n📊 Test Results:');
    console.log(`  ✅ Parameters modified: ${paramsModified} across all shader passes`);
    console.log(`  ✅ Screenshot saved: /tmp/claude/crt-gameplay-test.jpeg`);
    console.log(`  📺 CRT Status: ${crtEffectStatus}`);

    console.log('\n🔍 Look for these CRT effects in the screenshot:');
    console.log('  - Scanlines (horizontal lines across the screen)');
    console.log('  - Screen curvature (slightly curved edges)');
    console.log('  - Bloom/glow around bright elements');
    console.log('  - Color grading/phosphor effects');
    console.log('  - Sharpening on game elements');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
