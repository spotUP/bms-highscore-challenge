import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

let success = false;
let errors = [];

page.on('console', msg => {
  const text = msg.text();
  
  if (text.includes('pong-crt.slangp')) {
    console.log('✅ CRT preset:', text);
  }
  if (text.includes('Preset loaded successfully')) {
    success = true;
    console.log('✅ CRT PRESET LOADED!');
  }
  if (text.includes('❌') || text.includes('Failed')) {
    errors.push(text);
    console.log('❌', text);
  }
});

console.log('Loading with CRT scanlines preset...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n=== RESULT ===');
console.log('Success:', success);
console.log('Errors:', errors.length);

if (success) {
  console.log('\n✅ CRT SCANLINES SHOULD NOW BE VISIBLE!');
  console.log('📺 Look for horizontal scan lines across the screen');
} else {
  console.log('\n❌ CRT preset failed to load');
  if (errors.length > 0) {
    console.log('First error:', errors[0].substring(0, 200));
  }
}

console.log('\n⏳ Keeping browser open for 10 seconds...');
await new Promise(resolve => setTimeout(resolve, 10000));

await browser.close();
