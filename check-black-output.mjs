import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let logs = [];
page.on('console', msg => logs.push(msg.text()));

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

console.log('\n=== Uniform/Texture Logs ===');
const uniformLogs = logs.filter(l => 
  l.includes('uniform') || 
  l.includes('texture') || 
  l.includes('LUT') ||
  l.includes('sampler') ||
  l.includes('binding')
);
uniformLogs.slice(0, 30).forEach(l => console.log(l));

console.log('\n=== Pass Execution ===');
const passLogs = logs.filter(l => l.includes('pass_'));
passLogs.slice(0, 20).forEach(l => console.log(l));

await browser.close();
