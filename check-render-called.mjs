import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();

// Override console to catch EVERYTHING
await page.evaluateOnNewDocument(() => {
  const original = console.error;
  console.error = function(...args) {
    original.apply(console, ['[CAPTURED]', ...args]);
  };
});

let foundRender = false;
let foundBeginFrame = false;
let foundEndFrame = false;

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('RENDER') || text.includes('🎨')) {
    foundRender = true;
    console.log('📍 RENDER LOG:', text);
  }
  if (text.includes('beginFrame')) {
    foundBeginFrame = true;
    console.log('📍 BEGIN FRAME:', text);
  }
  if (text.includes('endFrame')) {
    foundEndFrame = true;
    console.log('📍 END FRAME:', text);
  }
});

console.log('Loading page...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

console.log('Waiting 3 seconds...');
await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n=== RESULTS ===');
console.log('Found RENDER logs:', foundRender);
console.log('Found beginFrame:', foundBeginFrame);
console.log('Found endFrame:', foundEndFrame);

// Check if render function exists in the global scope
const renderFunctionExists = await page.evaluate(() => {
  return typeof (window as any).renderRef !== 'undefined';
});

console.log('Render function in window:', renderFunctionExists);

await browser.close();
