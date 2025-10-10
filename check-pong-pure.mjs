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
    logs.push(msg.text());
  });

  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('PAGE ERROR:', error.message);
  });

  console.log('Loading Pure WebGL2 Pong page...');

  await page.goto('http://localhost:8080/pong', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await new Promise(r => setTimeout(r, 5000));

  // Check status
  const pageInfo = await page.evaluate(() => {
    return {
      bodyText: document.body.innerText.substring(0, 400),
      hasCanvas: !!document.querySelector('canvas')
    };
  });

  console.log('\n=== Page Info ===');
  console.log(pageInfo.bodyText);

  // Check for important logs
  const important = logs.filter(log =>
    log.includes('PongPureWebGL2') ||
    log.includes('game loop') ||
    log.includes('shader') ||
    log.includes('Ready') ||
    log.includes('ERROR') ||
    log.includes('Failed')
  );

  console.log('\n=== Important Logs ===');
  important.forEach(log => console.log(log));

  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    errors.forEach(err => console.log(err));
  }

  // Screenshot
  await page.screenshot({
    path: '/tmp/pong-pure-webgl2.jpg',
    type: 'jpeg',
    quality: 80,
    fullPage: false
  });
  console.log('\n✅ Screenshot saved to /tmp/pong-pure-webgl2.jpg');

  await browser.close();
})();
