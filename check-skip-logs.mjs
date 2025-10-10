import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Skipping global')) {
      logs.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  console.log('=== SKIPPED GLOBALS (first 20) ===');
  logs.slice(0, 20).forEach((log, i) => console.log((i+1) + '. ' + log));

  console.log('\n=== Total skipped: ' + logs.length + ' ===');

  const hasPotatoSkip = logs.some(l => l.includes('HSM_POTATO_COLORIZE_CRT_WITH_BG'));
  console.log('\nHSM_POTATO_COLORIZE_CRT_WITH_BG was skipped:', hasPotatoSkip);

  await browser.close();
})();
