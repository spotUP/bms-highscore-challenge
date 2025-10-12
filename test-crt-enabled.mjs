import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log('🎮 Loading Pong and enabling CRT shaders...\n');

  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for page to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Press 'C' to toggle CRT effect ON
    console.log('🔧 Pressing C to enable CRT effect...');
    await page.keyboard.press('c');

    // Wait for shader to compile and apply
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot with CRT enabled
    await page.screenshot({
      path: '/tmp/claude/crt-effects-enabled.jpeg',
      type: 'jpeg',
      quality: 85,
      fullPage: false
    });
    console.log('📸 Screenshot saved to /tmp/claude/crt-effects-enabled.jpeg');

    console.log('\n✅ CRT shaders should now be ENABLED');
    console.log('🔍 Check the screenshot for visual effects like scanlines, curvature, etc.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
