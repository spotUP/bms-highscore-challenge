import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const allMessages = [];
  page.on('console', msg => allMessages.push(msg.text()));

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  const shaderErrors = allMessages.filter(m => m.includes('ERROR:'));

  const redefinitionErrors = {};
  shaderErrors.forEach(err => {
    const match = err.match(/'(\w+)' : redefinition/);
    if (match) {
      const varName = match[1];
      redefinitionErrors[varName] = (redefinitionErrors[varName] || 0) + 1;
    }
  });

  console.log('=== REDEFINITION ERRORS ===');
  Object.entries(redefinitionErrors)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => console.log('  ' + count + 'x ' + name));

  console.log('\n=== SAMPLE FULL ERROR MESSAGES (first 10) ===');
  shaderErrors.slice(0, 10).forEach((err, i) => {
    console.log((i+1) + '. ' + err.slice(0, 150));
  });

  await browser.close();
})();
