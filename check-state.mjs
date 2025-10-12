import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('showStartScreen') || 
        text.includes('showAudioPrompt') ||
        text.includes('Dismiss') ||
        text.includes('START SCREEN') ||
        text.includes('ROCKET')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n=== Clicking canvas ===');
  await page.click('canvas');
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n=== Checking game state ===');
  const state = await page.evaluate(() => {
    return {
      hasCanvas: !!document.querySelector('canvas'),
      canvasVisible: window.getComputedStyle(document.querySelector('canvas')).display !== 'none'
    };
  });
  console.log('State:', state);

  await browser.close();
})();
