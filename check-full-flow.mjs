import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(msg.text());
  });

  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
  });

  console.log('Loading page...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log('\nWaiting 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\nClicking to dismiss audio prompt...');
  await page.click('canvas');
  
  console.log('\nWaiting 5 seconds after click...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  await browser.close();
})();
