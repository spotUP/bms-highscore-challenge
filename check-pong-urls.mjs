import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/tmp/puppeteer/chrome/mac_arm-140.0.7339.185/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    args: ['--no-sandbox']
  });

  const urls = [
    'http://localhost:8080/404',
    'http://localhost:8080/pong',
    'http://localhost:8080/slang-demo',
    'http://localhost:8080/'
  ];

  for (const url of urls) {
    console.log(`\n=== Testing ${url} ===`);
    const page = await browser.newPage();

    const logs = [];
    page.on('console', msg => {
      logs.push(msg.text());
    });

    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 10000
      });

      await new Promise(r => setTimeout(r, 2000));

      const pageInfo = await page.evaluate(() => {
        const title = document.title;
        const hasCanvas = !!document.querySelector('canvas');
        const bodyText = document.body.innerText.substring(0, 200);
        const h1Text = document.querySelector('h1')?.innerText || 'no h1';

        return { title, hasCanvas, bodyText, h1Text };
      });

      console.log('Page info:', pageInfo);

      // Check for Pong-specific logs
      const pongLogs = logs.filter(log =>
        log.includes('Three.js') ||
        log.includes('Pong') ||
        log.includes('WebSocket') ||
        log.includes('GameObjects')
      );

      if (pongLogs.length > 0) {
        console.log('Pong-related logs:', pongLogs.length);
      }

      await page.screenshot({
        path: `/tmp/screenshot-${url.split('/').pop() || 'root'}.jpg`,
        type: 'jpeg',
        quality: 60,
        fullPage: false
      });
      console.log(`Screenshot saved`);

    } catch (error) {
      console.log('Error:', error.message);
    }

    await page.close();
  }

  await browser.close();
})();
