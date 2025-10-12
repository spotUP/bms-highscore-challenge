import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Monitor console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[PureWebGL2MultiPass]') ||
        text.includes('Pass') ||
        text.includes('ERROR') ||
        text.includes('WebGL')) {
      console.log('[BROWSER]', text);
    }
  });

  // Navigate
  console.log('[TEST] Navigating to http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  // Wait for rendering
  console.log('[TEST] Waiting 3 seconds for shader compilation...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check for errors
  const hasErrors = await page.evaluate(() => {
    return window.__shaderErrors || false;
  });

  if (hasErrors) {
    console.log('[TEST] ❌ SHADER ERRORS DETECTED');
  } else {
    console.log('[TEST] ✅ No shader errors');
  }

  // Take screenshot
  console.log('[TEST] Taking screenshot...');
  await page.screenshot({
    path: '/tmp/test-14pass-sharpsmoother.jpg',
    type: 'jpeg',
    quality: 80,
    fullPage: false
  });

  console.log('[TEST] Screenshot saved to /tmp/test-14pass-sharpsmoother.jpg');
  console.log('[TEST] Keeping browser open for 60 seconds for inspection...');

  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
