import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('MEGA BEZEL') || 
        text.includes('Registered') ||
        text.includes('render') ||
        text.includes('AUDIO') ||
        text.includes('ERROR') ||
        text.includes('frame')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  await new Promise(resolve => setTimeout(resolve, 10000));

  await browser.close();
})();
