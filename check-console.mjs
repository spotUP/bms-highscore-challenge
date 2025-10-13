import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const errors = [];
  const warnings = [];
  const logs = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      errors.push(text);
      console.log('❌ ERROR:', text);
    } else if (type === 'warning') {
      warnings.push(text);
      console.log('⚠️  WARNING:', text);
    } else if (type === 'log') {
      logs.push(text);
      // Print shader/pass related logs
      if (text.includes('shader') || text.includes('Pass') || text.includes('WebGL') || text.includes('PASS OUTPUT')) {
        console.log('📋', text);
      }
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('❌ PAGE ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:8080/pong', { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n=== SUMMARY ===');
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ No console errors or warnings found!');
    }
  } catch (error) {
    console.log('❌ Failed to load page:', error.message);
  } finally {
    await browser.close();
  }
})();
