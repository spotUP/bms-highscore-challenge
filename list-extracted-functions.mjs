import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

const extractedFunctions = [];

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[SlangCompiler] ✅ Adding function to shader:')) {
    const funcName = text.split('Adding function to shader:')[1].trim();
    extractedFunctions.push(funcName);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n=== EXTRACTED FUNCTIONS (' + extractedFunctions.length + ') ===');
extractedFunctions.forEach((f, i) => console.log(`${i+1}. ${f}`));

await browser.close();
