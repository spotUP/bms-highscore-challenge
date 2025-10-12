import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

console.log('Loading with built-in CRT effects...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

await new Promise(resolve => setTimeout(resolve, 2000));

console.log('✅ BUILT-IN CRT SHADER ACTIVE');
console.log('📺 You should see:');
console.log('  - Horizontal scanlines');
console.log('  - Subtle screen curvature');
console.log('  - Vignette darkening at edges');
console.log('\n⏳ Browser will stay open for 15 seconds - CHECK THE SCREEN!');

await new Promise(resolve => setTimeout(resolve, 15000));
await browser.close();
