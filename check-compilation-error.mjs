import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => logs.push(msg.text()));

console.log('Loading page...');
try {
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 10000 });
} catch (e) {
  console.log('Page load timeout or error');
}

await new Promise(r => setTimeout(r, 2000));

console.log('\nERRORS:');
const errors = logs.filter(l => 
  l.includes('ERROR') || 
  l.includes('Failed') ||
  l.includes('error')
).slice(-20);
if (errors.length > 0) {
  errors.forEach(e => console.log('  ' + e));
} else {
  console.log('  No errors found');
}

console.log('\nLast 10 logs:');
logs.slice(-10).forEach(l => console.log('  ' + l));

await browser.close();
