import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

console.log('=== ALL CONSOLE OUTPUT ===\n');

page.on('console', msg => console.log(msg.text()));

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 1000));

// Click and start game
await page.mouse.click(960, 540);
await new Promise(resolve => setTimeout(resolve, 300));
await page.keyboard.press('Space');
await new Promise(resolve => setTimeout(resolve, 2000));

await browser.close();
