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
    // Filter for relevant messages
    if (text.includes('render') || 
        text.includes('game') || 
        text.includes('canvas') ||
        text.includes('WebGL') ||
        text.includes('shader') ||
        text.includes('ERROR') ||
        text.includes('pass_')) {
      console.log(text);
    }
  });

  console.log('Loading page...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\n=== PRESSING SPACE TO START ===');
  await page.keyboard.press('Space');
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.keyboard.press('Space');
  
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n=== TAKING SCREENSHOT ===');
  await page.screenshot({ path: '/tmp/game-render.jpg', type: 'jpeg', quality: 80 });
  console.log('Screenshot saved to /tmp/game-render.jpg');

  await browser.close();
})();
