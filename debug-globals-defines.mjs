import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Collect all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
  });

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });

    // Wait 3 seconds for shader compilation
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find messages about defines and globals
    const debugMessages = consoleMessages.filter(m =>
      m.includes('Define names:') ||
      m.includes('First 10 globals to check:') ||
      m.includes('SKIPPING global')
    );

    console.log('\n=== GLOBALS AND DEFINES DEBUG ===\n');
    debugMessages.forEach(m => {
      console.log(m);
      console.log('---');
    });

    console.log('\n=== DEBUG COMPLETE ===\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
