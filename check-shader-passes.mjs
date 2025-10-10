import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const passInfo = [];
  const errors = [];

  page.on('console', async msg => {
    const text = msg.text();

    // Look for pass execution info
    if (text.includes('[MultiPassRenderer] Pass') ||
        text.includes('Output to renderTarget') ||
        text.includes('Source texture') ||
        text.includes('FAILED')) {
      console.log('PASS INFO:', text);
      passInfo.push(text);
    }

    // Look for errors
    if (text.includes('ERROR') || text.includes('error') || text.includes('failed')) {
      console.log('ERROR:', text);
      errors.push(text);
    }

    // Look for null outputs
    if (text.includes('null') && (text.includes('texture') || text.includes('output'))) {
      console.log('NULL TEXTURE:', text);
      errors.push(text);
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
    errors.push('PAGE ERROR: ' + error.message);
  });

  console.log('Loading http://localhost:8080/slang-demo...');

  try {
    await page.goto('http://localhost:8080/slang-demo', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for rendering
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n=== PASS EXECUTION SUMMARY ===');
    console.log(`Total pass info logs: ${passInfo.length}`);
    console.log(`Total errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.slice(0, 10).forEach((err, i) => {
        console.log(`${i + 1}. ${err.substring(0, 200)}`);
      });
    }
  } catch (e) {
    console.error('Failed to load page:', e.message);
  }

  await browser.close();
})();
