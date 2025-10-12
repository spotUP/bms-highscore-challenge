import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Capture ALL console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    // Show fillRect calls immediately
    if (text.includes('fillRect')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

  // Wait for canvas
  await page.waitForSelector('canvas', { timeout: 5000 });

  // Click multiple times to ensure audio starts
  await page.click('body');
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.click('body');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Press space multiple times to start game
  await page.keyboard.press('Space');
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.keyboard.press('Space');

  // Wait 2 seconds for game to run
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check fillRect count
  const fillRectLogs = logs.filter(l => l.includes('fillRect'));
  console.log(`\n=== TOTAL fillRect LOGS: ${fillRectLogs.length} ===`);

  // Check early returns
  const earlyReturns = logs.filter(l => l.includes('[EARLY RETURN]'));
  console.log(`=== EARLY RETURNS: ${earlyReturns.length} ===`);
  if (earlyReturns.length > 0) {
    console.log('Last 3:', earlyReturns.slice(-3));
  }

  // Check BEGIN/END FRAME
  const beginFrames = logs.filter(l => l.includes('[BEGIN FRAME]'));
  const endFrames = logs.filter(l => l.includes('[END FRAME]'));
  console.log(`=== BEGIN/END FRAMES: ${beginFrames.length}/${endFrames.length} ===`);

  await browser.close();
})();
