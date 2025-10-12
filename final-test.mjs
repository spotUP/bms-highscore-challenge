import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ 
  headless: false, 
  args: ['--window-size=1920,1080'],
  devtools: false
});
const page = await browser.newPage();

let errorCount = 0;

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('Error') || text.includes('❌')) {
    errorCount++;
  }
});

page.on('pageerror', error => {
  console.log('❌ PAGE ERROR:', error.message);
  errorCount++;
});

console.log('Loading game...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

console.log('Waiting for game initialization...');
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('\n--- Test Results ---');
console.log('Errors encountered:', errorCount);
console.log('\nGame should now be visible in the browser window.');
console.log('Press Enter to close...');

// Keep browser open for manual inspection
await new Promise(resolve => setTimeout(resolve, 60000));
await browser.close();
