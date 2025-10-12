import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();

let renderCount = 0;
let beginFrameCount = 0;
let endFrameCount = 0;

page.on('console', msg => {
  const text = msg.text();
  
  // Count ALL render-related logs
  if (text.includes('RENDER')) renderCount++;
  if (text.includes('beginFrame')) beginFrameCount++;
  if (text.includes('endFrame')) endFrameCount++;
  
  // Show everything that might be relevant
  console.log(text);
});

console.log('Loading...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n=== COUNTS ===');
console.log('RENDER logs:', renderCount);
console.log('beginFrame:', beginFrameCount);
console.log('endFrame:', endFrameCount);

await browser.close();
