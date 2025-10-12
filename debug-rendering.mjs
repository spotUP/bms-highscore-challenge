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
    logs.push(text);

    // Look for rendering-related logs
    if (text.includes('render') ||
        text.includes('Executing pass') ||
        text.includes('WebGL') ||
        text.includes('shader') ||
        text.includes('black') ||
        text.includes('canvas') ||
        text.includes('texture') ||
        text.includes('framebuffer')) {
      console.log(`[LOG] ${text.substring(0, 200)}`);
    }

    if (msg.type() === 'error') {
      errors.push(text);
      console.log(`❌ ERROR: ${text.substring(0, 150)}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`🔴 PAGE ERROR: ${error.message}`);
    errors.push(error.message);
  });

  console.log('🎮 Opening http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('⏳ Waiting 10 seconds for shaders and rendering...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10000)));

  // Check if canvas is visible and has content
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    return {
      exists: true,
      width: canvas.width,
      height: canvas.height,
      displayWidth: rect.width,
      displayHeight: rect.height,
      visible: rect.width > 0 && rect.height > 0,
      hasContext: !!ctx
    };
  });

  console.log('\n🖼️  CANVAS INFO:');
  console.log(JSON.stringify(canvasInfo, null, 2));

  console.log('\n📊 SUMMARY:');
  console.log(`Total logs: ${logs.length}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach((err, i) => console.log(`  ${i + 1}. ${err.substring(0, 100)}`));
  }

  console.log('\n👀 Keeping browser open for inspection. Press Ctrl+C to close.');

  // Keep alive
  await new Promise(() => {});
})();
