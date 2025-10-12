import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

console.log('Loading page...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

await new Promise(resolve => setTimeout(resolve, 2000));

// Check how many canvases exist
const canvasInfo = await page.evaluate(() => {
  const canvases = document.querySelectorAll('canvas');
  return {
    count: canvases.length,
    canvases: Array.from(canvases).map((c, i) => ({
      index: i,
      width: c.width,
      height: c.height,
      visible: c.style.visibility !== 'hidden' && c.style.display !== 'none',
      position: window.getComputedStyle(c).position,
      zIndex: window.getComputedStyle(c).zIndex,
      top: window.getComputedStyle(c).top,
      left: window.getComputedStyle(c).left,
      rect: c.getBoundingClientRect()
    }))
  };
});

console.log('=== CANVAS COUNT ===');
console.log('Total canvases:', canvasInfo.count);
console.log('\n=== CANVAS DETAILS ===');
canvasInfo.canvases.forEach(c => {
  console.log(`\nCanvas ${c.index}:`);
  console.log('  Size:', c.width, 'x', c.height);
  console.log('  Visible:', c.visible);
  console.log('  Position:', c.position);
  console.log('  Z-index:', c.zIndex);
  console.log('  Location:', c.rect);
});

// Check if render is being called multiple times per frame
await page.evaluate(() => {
  let renderCount = 0;
  const originalError = console.error;
  console.error = function(...args) {
    const text = String(args[0]);
    if (text.includes('RENDER')) {
      renderCount++;
    }
    originalError.apply(console, args);
  };
  window.__renderCount = renderCount;
});

await new Promise(resolve => setTimeout(resolve, 1000));

const renderCount = await page.evaluate(() => window.__renderCount || 0);
console.log('\n=== RENDER CALLS ===');
console.log('Render calls in 1 second:', renderCount);

await browser.close();
