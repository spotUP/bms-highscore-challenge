import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();

const logs = [];
const errors = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
  if (text.includes('ERROR') || text.includes('Failed')) {
    errors.push(text);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2' });
await new Promise(resolve => setTimeout(resolve, 2000));

// Press space twice to start game
await page.keyboard.press('Space');
await new Promise(resolve => setTimeout(resolve, 200));
await page.keyboard.press('Space');
await new Promise(resolve => setTimeout(resolve, 1000));

// Press M to enable Mega Bezel shaders
console.log('Enabling Mega Bezel shaders...');
await page.keyboard.press('m');
await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n=== SHADER STATUS ===');
const successLogs = logs.filter(l => l.includes('Preset loaded successfully') || l.includes('Shaders loaded'));
successLogs.forEach(log => console.log('✅', log));

console.log('\n=== ERRORS ===');
if (errors.length === 0) {
  console.log('✅ No errors detected!');
} else {
  console.log(`❌ Found ${errors.length} errors:`);
  errors.forEach(err => console.log('  ', err));
}

console.log('\n=== MEGA BEZEL STATUS ===');
const megaBezelLogs = logs.filter(l => l.includes('MEGA BEZEL') || l.includes('PureWebGL2MultiPass'));
megaBezelLogs.forEach(log => console.log(log));

console.log('\nBrowser left open for visual verification. Press Ctrl+C when done.');
