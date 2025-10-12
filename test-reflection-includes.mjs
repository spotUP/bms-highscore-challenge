import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('IncludePreprocessor') || text.includes('common-functions') || text.includes('royale-geometry')) {
    console.log(text);
  }
  if (text.includes('ERROR') && text.includes('hrg_get_ideal_global_eye_pos')) {
    console.log('\n❌ MISSING FUNCTION:', text.substring(0, 200));
  }
});

console.log('Loading to check include processing...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

await new Promise(resolve => setTimeout(resolve, 3000));
await browser.close();
