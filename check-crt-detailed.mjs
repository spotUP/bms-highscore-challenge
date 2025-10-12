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
console.log('⏳ Waiting 5 seconds for shaders...');
await page.waitForTimeout(5000);

// Filter for compilation logs
console.log('\n📝 Shader Compilation Logs:');
logs.filter(l => l.includes('Program pass_') || l.includes('Compiling pass')).forEach(l => console.log('  ' + l));

// Filter for errors
const errors = logs.filter(l => l.includes('ERROR:') || l.toLowerCase().includes('failed to compile'));
if (errors.length > 0) {
  console.log('\n❌ COMPILATION ERRORS:');
  errors.forEach(e => console.log('  ' + e));
} else {
  console.log('\n✅ No compilation errors found');
}

// Check preset loaded
const presetLogs = logs.filter(l => l.includes('Preset loaded'));
console.log('\n📦 Preset Status:');
presetLogs.forEach(l => console.log('  ' + l));

// Check CRT shader specifically
console.log('\n🎯 Pass 14 (CRT Guest Advanced) Logs:');
logs.filter(l => l.includes('pass_14') || l.includes('shader14')).forEach(l => console.log('  ' + l));

await browser.close();
