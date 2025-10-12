import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();

    // Show LOADPRESET logs
    if (text.includes('LOADPRESET') || text.includes('loadPreset')) {
      console.log('📦', text);
    }

    // Show PresetParser logs
    if (text.includes('PresetParser')) {
      console.log('📝', text);
    }

    // Show preset loaded message
    if (text.includes('SHADER PRESET LOADED')) {
      console.log('✅', text);
    }
  });

  console.log('Opening http://localhost:8080/404 ...\n');

  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
  } catch (e) {
    console.log('Page loaded (navigation may have changed)\n');
  }

  console.log('Waiting 5 seconds for logs...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n✅ Done');
  await browser.close();
})();
