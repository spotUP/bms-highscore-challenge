import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const debugLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SlangCompiler]') && (
      text.includes('HSM_POTATO_COLORIZE_CRT_WITH_BG') ||
      text.includes('UBO initializer') ||
      text.includes('global.') ||
      text.includes('params.')
    )) {
      debugLogs.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  console.log('=== POTATO DEBUG LOGS ===');
  debugLogs.forEach((log, i) => console.log(`${i+1}. ${log}`));
  console.log(`\nTotal: ${debugLogs.length}`);

  await browser.close();
})();
