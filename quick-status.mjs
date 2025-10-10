import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let renderStatus = 'unknown';

// Set up console logging
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('Shader passes failed')) {
    renderStatus = 'fallback';
  }
  if (text.includes('Mega Bezel render successful')) {
    renderStatus = 'success';
  }
});

await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle2' });
await page.waitForTimeout(2000);

// Check page for debug message
const debugMessage = await page.evaluate(() => {
  const canvases = document.querySelectorAll('canvas');
  // Check if we have more than one canvas (shader effects would create multiple)
  return canvases.length;
});

console.log('Canvas count:', debugMessage);
console.log('Render status:', renderStatus);

await browser.close();