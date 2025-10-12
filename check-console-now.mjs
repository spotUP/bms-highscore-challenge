import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 }
  });
  const page = await browser.newPage();

  const errors = [];
  const warnings = [];

  // Collect console logs
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();

    if (type === 'error') {
      errors.push(text);
      console.log('[ERROR]', text);
    } else if (type === 'warning') {
      warnings.push(text);
    } else if (text.includes('ERROR') || text.includes('Failed') || text.includes('Black screen')) {
      console.log('[IMPORTANT]', text);
    }
  });

  // Collect page errors
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('[PAGE ERROR]', error.message);
  });

  console.log('Loading http://localhost:8080/404...');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle2',
    timeout: 15000
  });

  console.log('\n=== Waiting 10 seconds for shaders to compile ===\n');
  await page.waitForTimeout(10000);

  console.log('\n=== Summary ===');
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nError details:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('No errors detected! ✅');
  }

  // Check if canvas has content
  const hasContent = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const imageData = ctx.getImageData(
      canvas.width / 2 - 50,
      canvas.height / 2 - 50,
      100,
      100
    );

    // Check if any pixel is non-black
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 10 || imageData.data[i+1] > 10 || imageData.data[i+2] > 10) {
        return true;
      }
    }
    return false;
  });

  console.log(`\nCanvas has visible content: ${hasContent ? '✅ YES' : '❌ NO (BLACK SCREEN)'}`);

  await browser.close();
})();
