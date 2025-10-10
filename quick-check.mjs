import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  let errorCount = 0;
  let inlineFixCount = 0;
  const inlineMessages = [];

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('INLINE FRAGMENT FIX')) {
      inlineFixCount++;
      inlineMessages.push(text);
    }
    if (text.includes('ERROR') || text.includes('error') || text.includes('undeclared')) {
      errorCount++;
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n=== INLINE FIX LOGS ===');
    inlineMessages.forEach(msg => console.log('✓', msg));
    console.log(`\nTotal inline fix logs: ${inlineFixCount}`);
    console.log(`Total errors: ${errorCount}`);
  } catch (e) {
    console.log('Timeout or error:', e.message);
    console.log(`\nInline fix logs so far: ${inlineFixCount}`);
    console.log(`Total errors so far: ${errorCount}`);
  }

  await browser.close();
})();
