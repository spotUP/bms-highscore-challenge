import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  let compiling = false;
  let compiled = false;
  let error = null;

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('hsm-crt-guest-advanced')) {
      console.log('[CRT-GUEST]', text.substring(0, 150));
    }

    if (text.includes('Loading shader: pass_12')) {
      compiling = true;
      console.log('🔨 [CRT-GUEST] Starting compilation of pass 12...');
    }

    if (text.includes('Compiled pass_12') || text.includes('pass_12 compiled')) {
      compiled = true;
      console.log('✅ [CRT-GUEST] Pass 12 compiled successfully!');
    }

    if (text.includes('ERROR') && text.includes('12')) {
      error = text;
      console.log('❌ [ERROR]', text);
    }

    if (text.includes('Preset has') && text.includes('passes')) {
      console.log('📊', text);
    }

    if (text.includes('All') && text.includes('passes executed')) {
      console.log('✅', text);
    }
  });

  page.on('pageerror', err => {
    console.log('💥 PAGE ERROR:', err.message);
    error = err.message;
  });

  console.log('🌐 Opening http://localhost:8080/404\n');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 60000
  });

  console.log('\n⏳ Waiting 15 seconds for shader compilation...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  console.log('\n' + '='.repeat(60));
  console.log('CRT GUEST ADVANCED - DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log(`Compilation Started: ${compiling ? '✅' : '❌'}`);
  console.log(`Compilation Completed: ${compiled ? '✅' : '❌'}`);
  console.log(`Errors: ${error ? '❌ ' + error.substring(0, 100) : '✅ None'}`);
  console.log('='.repeat(60));

  console.log('\n⏸️  Browser staying open for inspection...');
  await new Promise(() => {});
})();
