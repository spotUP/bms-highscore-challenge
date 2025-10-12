import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Capture all console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);

    // Print logs related to parameter injection
    if (text.includes('parameter') ||
        text.includes('SHARPEN') ||
        text.includes('Injecting') ||
        text.includes('Modified') ||
        text.includes('override')) {
      console.log('✅', text);
    }
  });

  // Capture errors
  page.on('pageerror', error => {
    console.log('❌ Page error:', error.message);
  });

  console.log('🔍 Loading page and checking for parameter injection...\n');

  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait a bit for shaders to compile
    await page.waitForTimeout(5000);

    console.log('\n📊 Summary of parameter-related logs:');
    const paramLogs = logs.filter(log =>
      log.includes('parameter') ||
      log.includes('SHARPEN') ||
      log.includes('Injecting') ||
      log.includes('Modified') ||
      log.includes('override')
    );

    if (paramLogs.length === 0) {
      console.log('❌ No parameter injection logs found!');
    } else {
      console.log(`✅ Found ${paramLogs.length} parameter-related log entries`);
      paramLogs.forEach(log => console.log('  -', log));
    }

    // Take a screenshot to check visual effects
    await page.screenshot({
      path: '/tmp/claude/parameter-injection-test.jpeg',
      type: 'jpeg',
      quality: 85
    });
    console.log('\n📸 Screenshot saved to /tmp/claude/parameter-injection-test.jpeg');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
