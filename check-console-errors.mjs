import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const errors = [];
  const warnings = [];
  const pageErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();

    if (type === 'error') {
      // Filter out debug logging that looks like errors
      if (!text.includes('[removeDuplicateFunctions]') &&
          !text.includes('[buildGlobalDefinitionsCode]')) {
        errors.push(text);
        console.log(`❌ ERROR: ${text.substring(0, 150)}`);
      }
    } else if (type === 'warning') {
      warnings.push(text);
    }
  });

  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.log(`🔴 PAGE ERROR: ${error.message}`);
  });

  console.log('🎮 Opening http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('⏳ Waiting 10 seconds for shaders to compile...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10000)));

  console.log('\n📊 ERROR SUMMARY:');
  console.log(`❌ Console errors: ${errors.length}`);
  console.log(`⚠️  Console warnings: ${warnings.length}`);
  console.log(`🔴 Page errors: ${pageErrors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ CONSOLE ERRORS:');
    // Group similar errors
    const errorGroups = {};
    errors.forEach(err => {
      const key = err.substring(0, 100);
      errorGroups[key] = (errorGroups[key] || 0) + 1;
    });
    Object.entries(errorGroups).forEach(([err, count]) => {
      console.log(`  [${count}x] ${err}`);
    });
  }

  if (pageErrors.length > 0) {
    console.log('\n🔴 PAGE ERRORS:');
    pageErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  }

  console.log('\n👀 Browser window staying open for inspection. Press Ctrl+C to close.');

  // Keep alive
  await new Promise(() => {});
})();
