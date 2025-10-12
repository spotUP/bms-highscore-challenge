import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const allLogs = [];

  page.on('console', msg => {
    const text = msg.text();
    allLogs.push(text);
  });

  console.log('Opening http://localhost:8080/404 ...\n');

  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
  } catch (e) {
    // ignore
  }

  console.log('Waiting 3 seconds for logs...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('=== ALL CONSOLE LOGS (first 100) ===\n');
  allLogs.slice(0, 100).forEach((log, i) => {
    if (log.includes('LOAD') || log.includes('PRESET') || log.includes('Parser') || log.includes('🔥') || log.includes('🚀')) {
      console.log(`${i}: **${log}**`);
    } else {
      console.log(`${i}: ${log}`);
    }
  });

  await browser.close();
})();
