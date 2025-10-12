import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 }
  });
  const page = await browser.newPage();

  // Collect console logs
  page.on('console', msg => {
    const text = msg.text();
    console.log('[BROWSER]', text);
  });

  // Collect errors
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error.message);
  });

  console.log('Loading http://localhost:8080/404...');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle2',
    timeout: 15000
  });

  console.log('\n=== Waiting 8 seconds for shaders to load ===\n');
  await page.waitForTimeout(8000);

  console.log('\n=== Taking screenshot ===');
  await page.screenshot({ path: '/tmp/claude/potato-preset-test.jpg', type: 'jpeg', quality: 60 });
  console.log('Screenshot saved to /tmp/claude/potato-preset-test.jpg');

  await browser.close();
})();
