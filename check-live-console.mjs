import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,  // Show browser so user can see
    devtools: false
  });
  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    // Filter for our debug logs
    if (text.includes('beginFrame') || text.includes('fillRect #') || text.includes('BEGIN FRAME') || text.includes('shadersFailed')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

  console.log('\n=== Waiting for user interaction... ===');
  console.log('Click the page and press space to start the game');
  console.log('Watching for debug logs...\n');

  // Keep running for 30 seconds
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
