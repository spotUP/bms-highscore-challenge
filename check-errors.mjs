import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const errors = [];
  const logs = [];

  page.on('console', msg => {
    logs.push(msg.text());
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('🚨 PAGE ERROR:', error.message);
  });

  console.log('Opening page...\n');

  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
  } catch (e) {
    // ignore
  }

  console.log('Waiting 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('=== ERRORS ===');
  if (errors.length === 0) {
    console.log('❌ NO ERRORS - throw statements NOT executing!');
  } else {
    errors.forEach(err => console.log(`  ${err}`));
  }

  await browser.close();
})();
