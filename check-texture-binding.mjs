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
await new Promise(r => setTimeout(r, 3000));

// Check pass execution logs
console.log('\n📋 Pass Execution (Frame 1):');
const passLogs = logs.filter(l => l.includes('Executing pass') && l.includes('input:'));
passLogs.forEach(l => console.log('  ' + l));

// Check texture registration
console.log('\n📦 Texture Registration:');
const regLogs = logs.filter(l => l.includes('Registered texture') || l.includes('registerTexture'));
regLogs.forEach(l => console.log('  ' + l));

// Check for WebGL errors
console.log('\n❌ WebGL Errors:');
const errors = logs.filter(l => l.toLowerCase().includes('webgl') && l.toLowerCase().includes('error'));
if (errors.length > 0) {
  errors.slice(-5).forEach(l => console.log('  ' + l));
} else {
  console.log('  ✅ No WebGL errors');
}

await browser.close();
