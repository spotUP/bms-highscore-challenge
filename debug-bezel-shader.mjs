import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();

let bezelErrors = [];

page.on('console', msg => {
  const text = msg.text();
  
  // Capture bezel-related errors
  if (text.includes('bezel') || text.includes('pass_2') || text.includes('pass_3') || 
      text.includes('InfoCache') || text.includes('red') || text.includes('ERROR')) {
    bezelErrors.push(text);
  }
});

// Switch to the 4-pass bezel preset
await page.evaluate(() => localStorage.setItem('force-bezel', 'true'));

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 2000));

// Start game
await page.keyboard.press('Space');
await new Promise(resolve => setTimeout(resolve, 500));
await page.keyboard.press('Space');
await new Promise(resolve => setTimeout(resolve, 2000));

// Enable shaders with bezel
await page.keyboard.press('s');
await new Promise(resolve => setTimeout(resolve, 2000));
await page.keyboard.press('m');
await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n🔍 Bezel-related logs:');
bezelErrors.slice(-30).forEach(log => console.log('  ', log));

await browser.close();
