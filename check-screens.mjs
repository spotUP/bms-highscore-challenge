import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('AUDIO') || 
        text.includes('START') || 
        text.includes('showAudioPrompt') ||
        text.includes('showStartScreen') ||
        text.includes('ERROR')) {
      console.log(text);
    }
  });

  console.log('Loading page...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log('Waiting 15 seconds to see what screens appear...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  await browser.close();
})();
