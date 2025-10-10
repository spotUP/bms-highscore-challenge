import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);

    // Look for version-related logs
    if (text.includes('version') || text.includes('VERSION') || text.includes('convertToWebGL')) {
      console.log('[VERSION]', text);
    }
  });

  console.log('🔍 Loading shader demo page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait a bit for shaders to compile
  await page.waitForFunction(() => window.performance.now() > 5000, { timeout: 10000 });

  console.log('\n=== VERSION-RELATED LOGS ===\n');
  const versionLogs = logs.filter(log =>
    log.includes('version') || log.includes('VERSION') || log.includes('convertToWebGL')
  );

  versionLogs.slice(0, 50).forEach(log => console.log(log));

  await browser.close();
})();
