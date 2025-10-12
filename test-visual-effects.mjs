import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Track compilation logs
  let paramsInjected = false;
  let modificationsCount = 0;

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('Injecting') && text.includes('parameter overrides')) {
      paramsInjected = true;
      console.log('✅', text);
    }

    if (text.includes('Modified') && text.includes('parameter defaults')) {
      const match = text.match(/Modified (\d+) parameter/);
      if (match) modificationsCount = parseInt(match[1]);
      console.log('✅', text);
    }
  });

  console.log('🎮 Loading Pong with CRT shaders...\n');

  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for shaders to compile
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n📊 Results:');
    console.log(`  Parameters injected: ${paramsInjected ? '✅ YES' : '❌ NO'}`);
    console.log(`  Defaults modified: ${modificationsCount > 0 ? `✅ ${modificationsCount} parameters` : '❌ NONE'}`);

    // Take screenshot
    await page.screenshot({
      path: '/tmp/claude/crt-effects-test.jpeg',
      type: 'jpeg',
      quality: 85,
      fullPage: false
    });
    console.log('\n📸 Screenshot saved to /tmp/claude/crt-effects-test.jpeg');

    console.log('\n🔍 You can now visually inspect the game for CRT effects like:');
    console.log('  - Scanlines');
    console.log('  - Screen curvature');
    console.log('  - Color grading');
    console.log('  - Sharpening/bloom');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
