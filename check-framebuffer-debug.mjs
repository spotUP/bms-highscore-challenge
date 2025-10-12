import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('FRAMEBUFFER DEBUG') || 
        text.includes('MEGA BEZEL DEBUG') ||
        text.includes('beginFrame') ||
        text.includes('fillRect')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log('Waiting 5 seconds for debug output...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  await browser.close();
})();
