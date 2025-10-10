import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Processing HSM') || text.includes('Skipped') && text.includes('HSM')) {
      logs.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  console.log('=== HSM PROCESSING LOGS ===');
  logs.forEach((log, i) => console.log((i+1) + '. ' + log));
  console.log('\nTotal: ' + logs.length);

  await browser.close();
})();
