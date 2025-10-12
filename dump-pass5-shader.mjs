import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('pass_5') || text.includes('avg-lum') || text.includes('Final compiled vertex shader')) {
    console.log(`[CONSOLE:${msg.type().toUpperCase()}] ${text}`);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForTimeout(5000);

await browser.close();
