import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

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

  console.log('🎮 Testing Official MBZ__5__POTATO__EASYMODE preset');
  console.log('🎮 Navigating to http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('⏳ Waiting 10 seconds for all shaders to compile...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10000)));

  console.log('\n📊 SUMMARY:');
  console.log(`✓ Total console messages: ${logs.length}`);
  console.log(`✗ Total errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS FOUND:');
    errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  } else {
    console.log('\n✅ No page errors detected!');
  }

  // Check for pass compilation
  const passCompiled = logs.filter(l => l.text.includes('Program pass_') && l.text.includes('compiled successfully'));
  const passFailed = logs.filter(l => l.text.includes('Failed to compile') || l.text.includes('compilation failed'));

  console.log(`\n🎨 SHADER COMPILATION:`);
  console.log(`✅ Passes compiled: ${passCompiled.length}`);
  console.log(`❌ Passes failed: ${passFailed.length}`);

  passCompiled.forEach(log => console.log(`  ✓ ${log.text}`));
  if (passFailed.length > 0) {
    console.log('\nFailed passes:');
    passFailed.forEach(log => console.log(`  ✗ ${log.text.substring(0, 100)}`));
  }

  console.log('\n⏳ Keeping browser open for 20 seconds for visual inspection...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 20000)));

  await browser.close();
  console.log('✅ Test complete!');
})();
