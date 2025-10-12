import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

page.on('console', msg => console.log(msg.text()));

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n✅ Check the browser console for ❗❗❗ logs');
await new Promise(resolve => setTimeout(resolve, 10000));
await browser.close();
