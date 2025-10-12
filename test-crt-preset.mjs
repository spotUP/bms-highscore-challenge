import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

let presetLoaded = false;
let errors = [];

page.on('console', msg => {
  const text = msg.text();
  
  if (text.includes('tier1-with-crt')) {
    console.log('✅ CRT preset loading:', text);
  }
  if (text.includes('Preset loaded successfully')) {
    presetLoaded = true;
    console.log('✅ PRESET LOADED!');
  }
  if (text.includes('❌') || text.includes('ERROR') || text.includes('Failed')) {
    errors.push(text);
    console.log('❌', text);
  }
  if (text.includes('[SHADER]')) {
    console.log('🎨', text);
  }
});

console.log('🌐 Loading with CRT preset...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

console.log('⏳ Waiting for CRT shaders...\n');
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('\n=== RESULTS ===');
console.log('Preset loaded:', presetLoaded);
console.log('Errors:', errors.length);

console.log('\n🎮 Game should now have VISIBLE CRT scanlines!');
console.log('📺 Keep browser open for 10 seconds to verify...');

await new Promise(resolve => setTimeout(resolve, 10000));
await browser.close();
