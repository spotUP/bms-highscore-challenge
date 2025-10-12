import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let foundHrgFunction = false;
let foundCornerMask = false;

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('hrg_get_ideal_global_eye_pos') && text.includes('Extracted')) {
    foundHrgFunction = true;
    console.log('✅ FOUND:', text);
  }
  if (text.includes('HSM_GetCornerMask') && text.includes('Extracted')) {
    foundCornerMask = true;
    console.log('✅ FOUND:', text);
  }
  if (text.includes('Total functions extracted')) {
    console.log(text);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n=== RESULTS ===');
console.log('hrg_get_ideal_global_eye_pos extracted:', foundHrgFunction);
console.log('HSM_GetCornerMask extracted:', foundCornerMask);

await browser.close();
