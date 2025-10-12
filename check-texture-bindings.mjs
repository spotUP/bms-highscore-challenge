import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => logs.push(msg.text()));

console.log('Loading page...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

console.log('\nTexture/Alias Logs:');
const texLogs = logs.filter(l => 
  l.includes('aliased texture') || 
  l.includes('Registered texture') ||
  l.includes('alias') ||
  l.includes('PreCrtPass') ||
  l.includes('AfterglowPass')
);
texLogs.forEach(l => console.log('  ' + l));

console.log('\nPass Execution:');
const passLogs = logs.filter(l => l.includes('Executing pass') && l.includes('input:'));
passLogs.slice(0, 10).forEach(l => console.log('  ' + l));

await browser.close();
