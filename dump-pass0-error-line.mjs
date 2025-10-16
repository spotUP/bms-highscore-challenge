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

    // Find the error context for pass_0
    const errorContext = consoleMessages.filter(m =>
      (m.includes('>>>') && m.includes('1467')) ||
      (m.includes('   1467:') || m.includes('   1468:') || m.includes('   1466:'))
    );

    console.log('\n=== PASS_0 ERROR CONTEXT (Line 1467) ===\n');
    if (errorContext.length > 0) {
      errorContext.forEach(m => console.log(m));
    } else {
      console.log('No error context found. Looking for lines around 1467...');

      // Find the full shader dump
      const dumpMessages = consoleMessages.filter(m =>
        m.includes('1467:') || m.includes('1465:') || m.includes('1469:')
      );

      dumpMessages.slice(0, 15).forEach(m => console.log(m));
    }

    console.log('\n=== END ERROR CONTEXT ===\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
