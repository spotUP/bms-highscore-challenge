import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let beginCount = 0;
let endCount = 0;

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[BEGIN FRAME]')) beginCount++;
  if (text.includes('[END FRAME]')) endCount++;
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 1000));

// Click and start game
await page.mouse.click(960, 540);
await new Promise(resolve => setTimeout(resolve, 300));
await page.keyboard.press('Space');
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('beginFrame calls:', beginCount);
console.log('endFrame calls:', endCount);
console.log(beginCount > 0 && endCount > 0 ? '✅ WORKING' : '❌ NOT WORKING');

await browser.close();
