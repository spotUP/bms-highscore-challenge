import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[BEGIN FRAME]') || 
        text.includes('[END FRAME]') || 
        text.includes('to SCREEN') ||
        text.includes('Frame 1:') ||
        text.includes('Frame 2:')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await page.keyboard.press('Space');
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.keyboard.press('Space');
  await new Promise(resolve => setTimeout(resolve, 2000));

  await browser.close();
})();
