import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const allMessages = [];

  page.on('console', msg => {
    allMessages.push(msg.text());
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
  await page.click('body');

  // Wait for shader to exit (you said 2-3 seconds)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get ALL messages from the last 5 seconds
  console.log('=== ALL CONSOLE MESSAGES (last 100) ===\n');
  allMessages.slice(-100).forEach((msg, i) => {
    console.log(`[${allMessages.length - 100 + i}] ${msg}`);
  });

  await browser.close();
})();
