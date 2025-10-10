import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const stripLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Stripping') && text.includes('HSM_POTATO')) {
      stripLogs.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  console.log('=== POTATO IN STRIPPED LINES ===');
  stripLogs.forEach((log, i) => console.log(`${i+1}. ${log}`));
  console.log(`\nTotal: ${stripLogs.length}`);

  await browser.close();
})();
