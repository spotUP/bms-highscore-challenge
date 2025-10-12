import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set up console log capturing
  const logs = [];
  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    console.log(`[CONSOLE:${msg.type().toUpperCase()}]`, text);
    logs.push({ type: msg.type(), text });
  });

  page.on('pageerror', error => {
    console.log(`[PAGE ERROR]`, error.message);
    errors.push(error.message);
  });

  console.log('🎮 Navigating to http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('⏳ Waiting 5 seconds for game and shaders to load...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));

  console.log('\n📊 SUMMARY:');
  console.log(`✓ Total console messages: ${logs.length}`);
  console.log(`✗ Total errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS FOUND:');
    errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  } else {
    console.log('\n✅ No page errors detected!');
  }

  // Look for shader-specific logs
  const shaderLogs = logs.filter(l =>
    l.text.includes('SlangCompiler') ||
    l.text.includes('shader') ||
    l.text.includes('Pass') ||
    l.text.includes('ERROR:')
  );

  if (shaderLogs.length > 0) {
    console.log('\n🎨 SHADER LOGS:');
    shaderLogs.slice(0, 30).forEach(log => {
      const prefix = log.type === 'error' ? '❌' : log.type === 'warning' ? '⚠️' : '📝';
      console.log(`${prefix} ${log.text.substring(0, 120)}`);
    });
  }

  console.log('\n⏳ Keeping browser open for 30 seconds for manual inspection...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30000)));

  await browser.close();
  console.log('✅ Test complete!');
})();
