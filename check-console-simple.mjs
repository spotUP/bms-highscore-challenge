import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const messages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    messages.push(`[${type}] ${text}`);
  });

  await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Print all console messages
  console.log('\n=== CONSOLE MESSAGES ===\n');
  messages.forEach(msg => console.log(msg));

  // Check for errors
  const errors = messages.filter(m => m.includes('ERROR') || m.includes('undeclared'));
  console.log(`\n=== FOUND ${errors.length} ERRORS ===\n`);
  errors.forEach(err => console.log(err));

  await browser.close();
})();
