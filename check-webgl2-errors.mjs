import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/tmp/puppeteer/chrome/mac_arm-140.0.7339.185/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  const allLogs = [];
  page.on('console', msg => {
    allLogs.push(msg.text());
  });

  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('PAGE ERROR:', error.message);
  });

  console.log('Loading Pure WebGL2 test page...');

  await page.goto('http://localhost:8080/webgl2-test', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await new Promise(r => setTimeout(r, 5000));

  // Filter for errors and warnings
  const important = allLogs.filter(log =>
    log.toLowerCase().includes('error') ||
    log.toLowerCase().includes('warn') ||
    log.toLowerCase().includes('failed') ||
    log.toLowerCase().includes('render') ||
    log.toLowerCase().includes('execute')
  );

  console.log('\n=== Important Logs ===');
  important.forEach(log => console.log(log));

  if (errors.length > 0) {
    console.log('\n=== JavaScript Errors ===');
    errors.forEach(err => console.log(err));
  }

  console.log('\n=== Last 20 Console Logs ===');
  allLogs.slice(-20).forEach(log => console.log(log));

  await browser.close();
})();
