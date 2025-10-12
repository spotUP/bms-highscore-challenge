import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => logs.push(msg.text()));

console.log('Loading page...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4000));

console.log('\nCompilation Status:');
const compiled = logs.filter(l => l.includes('compiled successfully') || l.includes('Preset loaded'));
compiled.forEach(l => console.log('  ' + l));

console.log('\nFramebuffer Status:');
const fb = logs.filter(l => l.includes('[BEFORE SHADER]') || l.includes('[AFTER SHADER]'));
fb.slice(0, 4).forEach(l => console.log('  ' + l));

console.log('\nErrors:');
const errors = logs.filter(l => l.toLowerCase().includes('error') && !l.includes('ERROR HERE'));
if (errors.length > 0) {
  errors.slice(-5).forEach(e => console.log('  ' + e));
} else {
  console.log('  No errors');
}

await browser.close();
