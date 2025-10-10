import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/tmp/puppeteer/chrome/mac_arm-140.0.7339.185/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  // Capture console logs
  const logs = [];
  page.on('console', async msg => {
    const text = msg.text();
    logs.push(text);
    console.log('CONSOLE:', text);
  });

  // Capture errors
  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
  });

  console.log('Loading Pong page...');

  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle2',
    timeout: 20000
  });

  await new Promise(r => setTimeout(r, 3000));

  // Check for canvas element
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { found: false };

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');

    return {
      found: true,
      width: canvas.width,
      height: canvas.height,
      visible: rect.width > 0 && rect.height > 0,
      position: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      parentVisible: canvas.parentElement?.offsetParent !== null
    };
  });

  console.log('\n=== Canvas Info ===');
  console.log(JSON.stringify(canvasInfo, null, 2));

  // Check for game elements
  const gameElements = await page.evaluate(() => {
    return {
      body: document.body.innerHTML.length,
      hasCanvas: !!document.querySelector('canvas'),
      hasGameContainer: !!document.querySelector('[class*="game"]'),
      bodyStyle: window.getComputedStyle(document.body).display,
      allDivs: document.querySelectorAll('div').length
    };
  });

  console.log('\n=== Game Elements ===');
  console.log(JSON.stringify(gameElements, null, 2));

  // Take screenshot
  await page.screenshot({
    path: '/tmp/pong-screenshot.jpg',
    type: 'jpeg',
    quality: 80,
    fullPage: true
  });
  console.log('\n✅ Screenshot saved to /tmp/pong-screenshot.jpg');

  // Check for relevant console errors
  const errors = logs.filter(log =>
    log.includes('error') ||
    log.includes('Error') ||
    log.includes('failed') ||
    log.includes('Failed')
  );

  if (errors.length > 0) {
    console.log('\n=== Console Errors ===');
    errors.forEach(err => console.log(err));
  }

  await browser.close();
})();
