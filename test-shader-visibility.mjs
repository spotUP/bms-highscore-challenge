import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[SHADER]') || text.includes('MULTI-PASS') || text.includes('beginFrame') || text.includes('endFrame') || text.includes('❌')) {
    console.log(text);
  }
});

console.log('🌐 Loading game...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

console.log('⏳ Waiting 5 seconds for shaders to render...\n');
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('\n✅ Check the browser window - shaders should now be visible!');

await new Promise(resolve => setTimeout(resolve, 10000));
await browser.close();
