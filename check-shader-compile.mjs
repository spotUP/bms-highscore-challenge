import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('pass_11') || text.includes('crt-with-bezel') || text.includes('ERROR') || text.includes('Failed')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 10000));

  await browser.close();
})();
