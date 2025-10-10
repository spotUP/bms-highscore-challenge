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
  });

  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
  });

  console.log('Loading Pure WebGL2 test page...');

  await page.goto('http://localhost:8080/webgl2-test', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for rendering to start
  await new Promise(r => setTimeout(r, 3000));

  // Check for rendering logs
  const renderLogs = logs.filter(log =>
    log.includes('PureWebGL2MultiPass') ||
    log.includes('render') ||
    log.includes('execute') ||
    log.includes('ERROR') ||
    log.includes('Failed')
  );

  console.log('\n=== Rendering Logs ===');
  renderLogs.forEach(log => console.log(log));

  // Take screenshot
  await page.screenshot({
    path: '/tmp/webgl2-rendering.jpg',
    type: 'jpeg',
    quality: 80,
    fullPage: false
  });
  console.log('\n✅ Screenshot saved to /tmp/webgl2-rendering.jpg');

  await browser.close();
})();
