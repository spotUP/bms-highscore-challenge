import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
});

console.log('🔍 Loading page...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

// Wait and capture initial state
await new Promise(r => setTimeout(r, 2000));
console.log('\n📊 Shader passes after 2 seconds:');
logs.filter(l => l.includes('All') && l.includes('passes executed')).forEach(l => console.log('  ' + l));

// Check for errors
console.log('\n❌ Errors:');
logs.filter(l => l.includes('ERROR:') || l.toLowerCase().includes('error')).slice(-10).forEach(l => console.log('  ' + l));

// Check for pass numbering issues
console.log('\n🔢 Pass numbering:');
logs.filter(l => l.includes('Program pass_') && l.includes('compiled')).forEach(l => console.log('  ' + l));

// Check preset info
console.log('\n📦 Preset info:');
logs.filter(l => l.includes('shader count') || l.includes('Preset loaded')).forEach(l => console.log('  ' + l));

await browser.close();
