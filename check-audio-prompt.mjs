import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('audio') || 
        text.includes('Audio') || 
        text.includes('AUDIO') ||
        text.includes('prompt') ||
        text.includes('Dismiss')) {
      console.log(text);
    }
  });

  console.log('Loading page...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log('Waiting 8 seconds to observe audio prompt behavior...');
  await new Promise(resolve => setTimeout(resolve, 8000));

  await browser.close();
})();
