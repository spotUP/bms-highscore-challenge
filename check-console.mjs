import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const logs = [];
  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      errors.push(text);
      console.log('ERROR:', text);
    } else if (type === 'warning') {
      warnings.push(text);
      console.log('WARN:', text);
    } else {
      logs.push(text);
      console.log('LOG:', text);
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('PAGE ERROR:', error.message);
  });

  console.log('Loading http://localhost:8080/slang-demo...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  // Wait a bit for shaders to compile
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n=== SUMMARY ===');
  console.log(`Total logs: ${logs.length}`);
  console.log(`Total warnings: ${warnings.length}`);
  console.log(`Total errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n=== ERRORS ===');
    errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
  }

  if (warnings.length > 0) {
    console.log('\n=== WARNINGS ===');
    warnings.forEach((warn, i) => console.log(`${i + 1}. ${warn}`));
  }

  await browser.close();
})();
