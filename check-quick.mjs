import puppeteer from 'puppeteer';

async function quickCheck() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      console.log(`[ERROR] ${text}`);
      errors.push(text);
    }
  });

  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
    errors.push(error.message);
  });

  try {
    console.log('→ Loading page (no wait)...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n=== SUMMARY ===');
    console.log(`Total errors: ${errors.length}`);

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

quickCheck();
