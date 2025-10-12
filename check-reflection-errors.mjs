import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    if (type === 'error' || text.includes('ERROR') || text.includes('FAILED') || text.includes('Failed')) {
      errors.push(text);
      console.log(text);
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('[PAGE ERROR]', error.message);
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log(`\nTotal errors: ${errors.length}`);

  await browser.close();
})();
