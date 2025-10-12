import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Capture ALL console messages
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
  await page.waitForSelector('canvas', { timeout: 5000 });

  // Click and press space
  await page.click('body');
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.keyboard.press('Space');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check if setRenderTarget exists
  const hasMethod = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas' };

    // Check if WebGL2D instance has setRenderTarget
    return {
      canvasExists: true,
      hasWebGL2DGlobally: typeof window.WebGL2D !== 'undefined'
    };
  });

  console.log('\n=== Browser State ===');
  console.log(JSON.stringify(hasMethod, null, 2));

  // Check for our new logs
  const renderTargetLogs = logs.filter(l => l.includes('Render target set'));
  const beginFrameLogs = logs.filter(l => l.includes('beginFrame'));
  const fillRectLogs = logs.filter(l => l.includes('fillRect'));

  console.log('\n=== Console Logs ===');
  console.log(`Render target logs: ${renderTargetLogs.length}`);
  console.log(`beginFrame logs: ${beginFrameLogs.length}`);
  console.log(`fillRect logs: ${fillRectLogs.length}`);

  if (renderTargetLogs.length > 0) {
    console.log('\nRender target logs:');
    renderTargetLogs.slice(0, 5).forEach(l => console.log('  ', l));
  }

  if (fillRectLogs.length > 0) {
    console.log('\nFirst 3 fillRect logs:');
    fillRectLogs.slice(0, 3).forEach(l => console.log('  ', l));
  }

  await browser.close();
})();
