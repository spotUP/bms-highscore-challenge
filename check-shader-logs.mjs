import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('MultiPassRenderer') || text.includes('MegaBezelLoader') || text.includes('pixel')) {
    logs.push(text);
  }
});

await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle0', timeout: 10000 });
await page.waitForTimeout(2000);

console.log('=== Shader Logs ===');
logs.forEach(log => console.log(log));

await browser.close();
