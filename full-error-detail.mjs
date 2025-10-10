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

  const potatoErrors = allMessages.filter(m => m.includes('HSM_POTATO_COLORIZE_CRT_WITH_BG'));

  console.log('=== FULL HSM_POTATO_COLORIZE_CRT_WITH_BG ERRORS (first 3) ===');
  potatoErrors.slice(0, 3).forEach((err, i) => {
    console.log('\n' + (i+1) + '. ' + err);
  });

  await browser.close();
})();
