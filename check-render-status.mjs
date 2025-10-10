import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false }); // Show browser
const page = await browser.newPage();

// Set up console logging
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('render') || text.includes('Fallback') || text.includes('Mega Bezel')) {
    console.log(text);
  }
});

console.log('Loading shader demo...');
await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle2' });

// Wait for rendering
await page.waitForTimeout(3000);

// Check for visual effects
const hasEffects = await page.evaluate(() => {
  // Check if the debug overlay mentions fallback
  const debugOverlay = document.querySelector('.debug-overlay');
  if (debugOverlay) {
    const text = debugOverlay.textContent || '';
    return !text.includes('Fallback');
  }
  return false;
});

console.log('\n=== RENDER STATUS ===');
console.log(hasEffects ? '✅ Visual effects are rendering!' : '❌ Still in fallback mode');

// Keep browser open for inspection
console.log('\nBrowser window kept open. Check the visual effects manually.');
console.log('Close the browser window when done.');