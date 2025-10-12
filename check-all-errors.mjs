import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture ALL console messages
  const allMessages = [];
  page.on('console', msg => {
    allMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.toString());
  });

  console.log('Loading game...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('Monitoring for 10 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Filter errors
  const errors = allMessages.filter(m => m.type === 'error');
  const warnings = allMessages.filter(m => m.type === 'warning');
  const shaderLogs = allMessages.filter(m =>
    m.text.includes('[MEGA BEZEL]') ||
    m.text.includes('[PASSTHROUGH]') ||
    m.text.includes('SHADER')
  );

  console.log('='.repeat(80));
  console.log('COMPLETE ERROR ANALYSIS');
  console.log('='.repeat(80));

  console.log('\n📛 PAGE ERRORS:');
  if (pageErrors.length === 0) {
    console.log('  None!');
  } else {
    pageErrors.forEach(err => console.log(`  ${err}`));
  }

  console.log('\n❌ CONSOLE ERRORS:');
  if (errors.length === 0) {
    console.log('  None!');
  } else {
    errors.forEach(err => console.log(`  ${err.text}`));
  }

  console.log('\n⚠️  CONSOLE WARNINGS:');
  if (warnings.length === 0) {
    console.log('  None!');
  } else {
    // Show first 20
    warnings.slice(0, 20).forEach(warn => console.log(`  ${warn.text}`));
    if (warnings.length > 20) {
      console.log(`  ... and ${warnings.length - 20} more warnings`);
    }
  }

  console.log('\n🎨 SHADER RENDERING LOGS (first 30):');
  shaderLogs.slice(0, 30).forEach(log => console.log(`  ${log.text}`));

  console.log('\n📊 SUMMARY:');
  console.log(`  Total messages: ${allMessages.length}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Shader logs: ${shaderLogs.length}`);

  console.log('='.repeat(80));

  await browser.close();
})();
