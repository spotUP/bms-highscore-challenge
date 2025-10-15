import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Collect console messages
  const logs = [];
  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    logs.push({ type, text });

    if (type === 'error' || type === 'warning') {
      errors.push({ type, text });
    }
  });

  page.on('pageerror', error => {
    errors.push({ type: 'pageerror', text: error.toString() });
  });

  try {
    console.log('Navigating to http://localhost:8080/404');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded', // Don't wait for network idle
      timeout: 10000
    });

    // Wait longer for shader loading and rendering
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n=== CONSOLE LOGS ===');
    logs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });

    console.log('\n=== ERRORS AND WARNINGS ===');
    if (errors.length === 0) {
      console.log('No errors or warnings found!');
    } else {
      errors.forEach(error => {
        console.log(`[${error.type}] ${error.text}`);
      });
    }

    // Take a screenshot
    await page.screenshot({ path: '/tmp/screenshot.jpeg', type: 'jpeg', quality: 50 });
    console.log('\n=== Screenshot saved to /tmp/screenshot.jpeg ===');

  } catch (error) {
    console.error('Error during page load:', error.message);
  } finally {
    await browser.close();
  }
})();
