import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  console.log('Loading game with shaders...\n');

  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

  // Wait for shaders to load and render
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Take a screenshot
  await page.screenshot({ path: '/tmp/shader-test.jpg', type: 'jpeg', quality: 80 });

  console.log('✅ Screenshot saved to /tmp/shader-test.jpg');
  console.log('\nCheck if the game now shows CRT effects (scanlines, curvature, color grading)');
  console.log('The shaders ARE working if you see visual effects different from flat colors.\n');

  await browser.close();
})();
