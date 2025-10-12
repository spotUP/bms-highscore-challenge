import puppeteer from 'puppeteer';

console.log('🔍 Testing frame clearing fix...\n');

const browser = await puppeteer.launch({
  headless: false,
  args: ['--window-size=1920,1080'],
  defaultViewport: null
});

const page = await browser.newPage();

console.log('📡 Loading game...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

console.log('⏱️  Waiting 2 seconds...');
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('🖱️  Clicking to dismiss audio prompt...');
await page.mouse.click(960, 540);
await new Promise(resolve => setTimeout(resolve, 500));

console.log('⌨️  Pressing SPACE to start game...');
await page.keyboard.press('Space');

console.log('\n✅ Game started - check the browser window!');
console.log('The screen should now clear properly between frames.');
console.log('You should NOT see overlapping text/graphics.');
console.log('\nPress Ctrl+C when done checking...\n');

// Keep open for manual verification
await new Promise(resolve => setTimeout(resolve, 60000));
await browser.close();
