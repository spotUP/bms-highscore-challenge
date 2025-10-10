import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Fragment global')) {
      logs.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 10000));
  } catch (e) {
    console.log('Timeout:', e.message);
  }

  console.log('=== Fragment Global Injection Logs ===');
  logs.forEach(log => console.log(log));
  console.log(`\nTotal: ${logs.length} logs`);

  await browser.close();
})();
