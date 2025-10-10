import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle0',
    timeout: 15000
  });

  // Wait a bit for shaders to compile
  await page.waitForTimeout(5000);

  console.log('\n=== CONSOLE LOGS ===\n');
  logs.forEach(log => console.log(log));

  console.log('\n=== ERROR SUMMARY ===\n');
  console.log(`Total logs: ${logs.length}`);
  console.log(`Total errors: ${errors.length}`);

  await browser.close();
})();
