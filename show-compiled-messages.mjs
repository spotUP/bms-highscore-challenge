import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(msg.text()));

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 15000));

    const compiledMessages = consoleMessages.filter(m => /compiled/i.test(m));
    console.log(`\n📊 Found ${compiledMessages.length} compilation messages\n`);
    console.log('All compiled messages:');
    compiledMessages.forEach((m, i) => console.log(`  ${i + 1}. ${m.substring(0, 200)}`));

    console.log('\n=== SUMMARY ===');
    const passCompiled = compiledMessages.filter(m => m.includes('pass_'));
    console.log(`✅ ${passCompiled.length} shader passes compiled successfully`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
