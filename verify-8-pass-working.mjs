import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleMessages = [];

  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  console.log('Loading game with 8-pass potato preset...');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('Waiting 10 seconds for shader execution...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Take screenshot
  await page.screenshot({
    path: '/tmp/potato-8-pass-working.jpg',
    type: 'jpeg',
    quality: 80
  });

  // Check for errors
  const errors = consoleMessages.filter(msg =>
    msg.includes('ERROR') ||
    msg.includes('Failed') ||
    msg.includes('Compilation failed') ||
    msg.includes('WebGL error') ||
    msg.includes('Bypassing shaders')
  );

  // Check for success indicators
  const compilationSuccess = consoleMessages.filter(msg =>
    msg.includes('✅ All') && msg.includes('passes compiled')
  );

  const shadersEnabled = consoleMessages.filter(msg =>
    msg.includes('shadersEnabled=true')
  );

  console.log('\n='.repeat(80));
  console.log('8-PASS POTATO PRESET VERIFICATION');
  console.log('='.repeat(80));
  console.log(`Total console messages: ${consoleMessages.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Compilation success messages: ${compilationSuccess.length}`);
  console.log(`shadersEnabled=true messages: ${shadersEnabled.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS DETECTED:');
    errors.forEach(err => console.log('  ', err));
  } else {
    console.log('\n✅ NO ERRORS - All 8 passes working!');
  }

  if (compilationSuccess.length > 0) {
    console.log('\nCOMPILATION SUCCESS:');
    compilationSuccess.forEach(msg => console.log('  ', msg));
  }

  if (shadersEnabled.length > 0) {
    console.log('\nSHADERS ENABLED (last 3 messages):');
    shadersEnabled.slice(-3).forEach(msg => console.log('  ', msg));
  }

  console.log('\nScreenshot: /tmp/potato-8-pass-working.jpg');
  console.log('='.repeat(80) + '\n');

  await browser.close();
})();
