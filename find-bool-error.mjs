import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    console.log(text);
  });

  try {
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.keyboard.press('s');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.keyboard.press('m');
    await new Promise(resolve => setTimeout(resolve, 8000));

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
