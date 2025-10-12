import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

let success = false;
let errors = [];

page.on('console', msg => {
  const text = msg.text();
  
  if (text.includes('minimal-reflection')) {
    console.log('📍 Reflection preset:', text);
  }
  if (text.includes('Preset loaded successfully')) {
    success = true;
    console.log('✅ REFLECTION PRESET LOADED!');
  }
  if (text.includes('ReflectionPass') || text.includes('reflection')) {
    console.log('🪞', text);
  }
  if (text.includes('❌') || text.includes('Failed') || text.includes('ERROR')) {
    errors.push(text);
    console.log('❌', text);
  }
});

console.log('Loading minimal reflection preset...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n=== RESULT ===');
console.log('Success:', success);
console.log('Errors:', errors.length);

if (success) {
  console.log('\n✅ REFLECTION SHADER ACTIVE!');
  console.log('🪞 You should see screen reflections');
} else if (errors.length > 0) {
  console.log('\n❌ Reflection failed:');
  console.log(errors[0].substring(0, 300));
}

console.log('\n⏳ Keeping browser open for 10 seconds...');
await new Promise(resolve => setTimeout(resolve, 10000));
await browser.close();
