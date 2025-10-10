import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/tmp/puppeteer/chrome/mac_arm-140.0.7339.185/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log('CONSOLE:', text);
  });

  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
  });

  console.log('Loading Pure WebGL2 test page...');

  try {
    await page.goto('http://localhost:8080/webgl2-test', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(r => setTimeout(r, 5000));

    const pageInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return {
        hasCanvas: !!canvas,
        canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
        bodyText: document.body.innerText.substring(0, 300)
      };
    });

    console.log('\n=== Page Info ===');
    console.log(JSON.stringify(pageInfo, null, 2));

    // Filter for important logs
    const importantLogs = logs.filter(log =>
      log.includes('PureWebGL2') ||
      log.includes('compiled') ||
      log.includes('ERROR') ||
      log.includes('error') ||
      log.includes('✅') ||
      log.includes('❌')
    );

    console.log('\n=== Important Logs ===');
    importantLogs.forEach(log => console.log(log));

    await page.screenshot({
      path: '/tmp/webgl2-test.jpg',
      type: 'jpeg',
      quality: 80,
      fullPage: false
    });
    console.log('\n✅ Screenshot saved to /tmp/webgl2-test.jpg');

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
})();
