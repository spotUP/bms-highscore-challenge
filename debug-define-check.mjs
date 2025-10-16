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

    // Find messages about #defines
    const defineMessages = consoleMessages.filter(m =>
      m.includes('#defines in globalDefs') || m.includes('SKIPPING global')
    );

    console.log('\n=== DEFINE CHECK DEBUG ===\n');
    console.log(`Found ${defineMessages.length} messages about defines:`);
    defineMessages.forEach(m => console.log(m));

    // Find pass_0 related messages
    const pass0Messages = consoleMessages.filter(m =>
      m.includes('pass_0') || m.includes('drez-none')
    );

    console.log('\n=== PASS_0 MESSAGES ===\n');
    pass0Messages.slice(0, 20).forEach(m => console.log(m));

    console.log('\n=== DEBUG COMPLETE ===\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
