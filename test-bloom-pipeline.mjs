import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  let passCount = 0;
  let allPassesExecuted = false;
  let errors = [];

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('Preset has') && text.includes('passes')) {
      const match = text.match(/(\d+) passes/);
      if (match) passCount = parseInt(match[1]);
      console.log('📊', text);
    }

    if (text.includes('Registered alias')) {
      console.log('🏷️ ', text);
    }

    if (text.includes('gaussian') || text.includes('bloom') || text.includes('Glow')) {
      console.log('[GLOW/BLOOM]', text.substring(0, 120));
    }

    if (text.includes('All') && text.includes('passes executed')) {
      allPassesExecuted = true;
      console.log('✅', text);
    }

    if (text.includes('ERROR') || text.includes('error')) {
      errors.push(text);
      console.log('❌', text.substring(0, 150));
    }
  });

  page.on('pageerror', err => {
    console.log('💥 PAGE ERROR:', err.message);
    errors.push(err.message);
  });

  console.log('🌐 Opening http://localhost:8080/404\n');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('\n⏳ Waiting 10 seconds for shader compilation...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n' + '='.repeat(70));
  console.log('GLOW + BLOOM PIPELINE TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Passes: ${passCount}`);
  console.log(`All Passes Executed: ${allPassesExecuted ? '✅ YES' : '❌ NO'}`);
  console.log(`Errors: ${errors.length === 0 ? '✅ None' : '❌ ' + errors.length + ' errors'}`);
  console.log('='.repeat(70));

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.slice(0, 5).forEach((err, i) => console.log(`  ${i + 1}. ${err.substring(0, 100)}`));
  }

  console.log('\n⏸️  Browser staying open for inspection. Dismiss audio prompt and start game to see effects!');
  await new Promise(() => {});
})();
