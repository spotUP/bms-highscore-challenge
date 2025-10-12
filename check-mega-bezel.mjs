import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(text);
  });

  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error.message);
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 10000));

  await browser.close();
})();
