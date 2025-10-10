import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const errors = [];
  const inlineMessages = [];

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('INLINE FRAGMENT FIX')) {
      inlineMessages.push(text);
    }
    if (text.includes('ERROR') || text.includes('undeclared identifier') || text.includes('already defined')) {
      errors.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 10000));
  } catch (e) {
    console.log('Page load error:', e.message);
  }

  console.log('=== INLINE FIX LOGS ===');
  inlineMessages.forEach((msg, idx) => console.log(`${idx + 1}.`, msg));

  console.log(`\n=== ERROR ANALYSIS (${errors.length} total errors) ===`);
  const errorTypes = {};
  errors.forEach(err => {
    if (err.includes('undeclared identifier')) {
      const match = err.match(/undeclared identifier '(\w+)'/);
      const varName = match ? match[1] : 'unknown';
      errorTypes[`undeclared: ${varName}`] = (errorTypes[`undeclared: ${varName}`] || 0) + 1;
    } else if (err.includes('already defined')) {
      const match = err.match(/'(\w+)' : already defined/);
      const varName = match ? match[1] : 'unknown';
      errorTypes[`redefined: ${varName}`] = (errorTypes[`redefined: ${varName}`] || 0) + 1;
    } else if (err.includes('ERROR')) {
      errorTypes['other'] = (errorTypes['other'] || 0) + 1;
    }
  });

  console.log('\nMost common errors:');
  Object.entries(errorTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([type, count]) => console.log(`  ${count}x ${type}`));

  console.log(`\n=== Sample errors (first 15) ===`);
  errors.slice(0, 15).forEach((err, idx) => console.log(`${idx + 1}. ${err.substring(0, 150)}`));

  await browser.close();
})();
