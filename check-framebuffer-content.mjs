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
await new Promise(r => setTimeout(r, 5000));

// Check framebuffer content
console.log('\n📊 Framebuffer Content (BEFORE shader):');
const beforeLogs = logs.filter(l => l.includes('[BEFORE SHADER]'));
if (beforeLogs.length > 0) {
  beforeLogs.forEach(l => console.log('  ' + l));
} else {
  console.log('  ❌ No BEFORE SHADER logs found');
}

console.log('\n📊 Framebuffer Content (AFTER shader):');
const afterLogs = logs.filter(l => l.includes('[AFTER SHADER]'));
if (afterLogs.length > 0) {
  afterLogs.forEach(l => console.log('  ' + l));
} else {
  console.log('  ❌ No AFTER SHADER logs found');
}

// Check shader transformation
console.log('\n🔄 Shader Transformation:');
const transformLogs = logs.filter(l => l.includes('Shader transform') || l.includes('COLOR CHANGE'));
if (transformLogs.length > 0) {
  transformLogs.forEach(l => console.log('  ' + l));
} else {
  console.log('  ℹ️  No transformation logs');
}

await browser.close();
