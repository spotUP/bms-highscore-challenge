import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SlangCompiler]') && (
      text.includes('Stripping') ||
      text.includes('UBO initializer') ||
      text.includes('redefinition')
    )) {
      logs.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  console.log('=== UBO STRIPPING LOGS ===');
  logs.forEach((log, i) => console.log(`${i+1}. ${log}`));
  console.log(`\nTotal: ${logs.length}`);

  // Also check for redefinition errors
  const allLogs = [];
  page.on('console', msg => allLogs.push(msg.text()));
  
  const redefinitions = allLogs.filter(l => l.includes('redefinition'));
  console.log(`\n=== REDEFINITION ERRORS ===`);
  console.log(`Total: ${redefinitions.length}`);
  if (redefinitions.length > 0) {
    console.log(`First 3:`);
    redefinitions.slice(0, 3).forEach((log, i) => console.log(`${i+1}. ${log.substring(0, 100)}`));
  }

  await browser.close();
})();
