import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  try {
    await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle0', timeout: 10000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('Error:', e.message);
  }

  await browser.close();
})();
