import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
  });

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Search for various completion patterns
    const patterns = [
      /Compiled/i,
      /compiled/i,
      /success/i,
      /complete/i,
      /finish/i,
      /done/i,
      /loaded/i
    ];

    console.log('\n=== SEARCHING FOR COMPILATION MESSAGES ===\n');

    patterns.forEach(pattern => {
      const matches = consoleMessages.filter(m => pattern.test(m));
      console.log(`Pattern "${pattern}": ${matches.length} matches`);
      if (matches.length > 0 && matches.length < 10) {
        matches.forEach(m => console.log(`  - ${m.substring(0, 150)}`));
      }
    });

    // Show messages with "pass_"
    const passMessages = consoleMessages.filter(m => m.includes('pass_'));
    console.log(`\n📊 ${passMessages.length} messages with "pass_"`);
    console.log('\nLast 20 pass_ messages:');
    passMessages.slice(-20).forEach(m => console.log(`  ${m.substring(0, 150)}`));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
