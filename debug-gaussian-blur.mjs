import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const logs = [];
  let gaussianCompiled = false;
  let gaussianError = null;
  let allPassesExecuted = false;

  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);

    // Track gaussian blur shader
    if (text.includes('gaussian') || text.includes('Gaussian')) {
      console.log('[GAUSSIAN]', text.substring(0, 150));
    }

    if (text.includes('pass_12') || text.includes('Pass 12')) {
      console.log('[PASS-12]', text.substring(0, 150));
    }

    if (text.includes('Compiled pass_12') || (text.includes('pass_12') && text.includes('compiled'))) {
      gaussianCompiled = true;
      console.log('✅ [GAUSSIAN] Pass 12 compiled successfully');
    }

    if (text.includes('All') && text.includes('passes executed')) {
      allPassesExecuted = true;
      console.log('✅ [EXEC] All passes executed');
    }

    if (text.includes('ERROR') || text.includes('error')) {
      if (text.includes('12') || text.includes('gaussian') || text.includes('blur')) {
        gaussianError = text;
        console.log('❌ [ERROR]', text);
      }
    }

    if (text.includes('WebGL') && (text.includes('error') || text.includes('ERROR'))) {
      console.log('🔴 [WEBGL ERROR]', text);
    }
  });

  page.on('pageerror', err => {
    console.log('💥 [PAGE ERROR]', err.message);
    gaussianError = err.message;
  });

  console.log('🌐 Opening http://localhost:8080/404\n');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('\n⏳ Waiting 10 seconds for shader compilation...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n' + '='.repeat(70));
  console.log('GAUSSIAN BLUR DEBUG SUMMARY');
  console.log('='.repeat(70));
  console.log(`Pass 12 (Gaussian) Compiled: ${gaussianCompiled ? '✅ YES' : '❌ NO'}`);
  console.log(`All Passes Executed: ${allPassesExecuted ? '✅ YES' : '❌ NO'}`);
  console.log(`Errors: ${gaussianError ? '❌ ' + gaussianError.substring(0, 100) : '✅ None detected'}`);

  // Check for specific shader uniform/texture issues
  const uniformErrors = logs.filter(l =>
    l.includes('uniform') && (l.includes('error') || l.includes('ERROR'))
  );

  if (uniformErrors.length > 0) {
    console.log('\n⚠️  UNIFORM/TEXTURE ERRORS:');
    uniformErrors.forEach(err => console.log(`  - ${err.substring(0, 120)}`));
  }

  // Check for framebuffer issues
  const fbErrors = logs.filter(l =>
    l.includes('framebuffer') && (l.includes('error') || l.includes('ERROR') || l.includes('incomplete'))
  );

  if (fbErrors.length > 0) {
    console.log('\n⚠️  FRAMEBUFFER ERRORS:');
    fbErrors.forEach(err => console.log(`  - ${err.substring(0, 120)}`));
  }

  console.log('='.repeat(70));
  console.log('\n⏸️  Browser staying open for visual inspection...');
  await new Promise(() => {});
})();
