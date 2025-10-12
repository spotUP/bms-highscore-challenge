import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('showAudioPrompt') || 
        text.includes('showStartScreen') ||
        text.includes('Dismiss') ||
        text.includes('AUDIO') ||
        text.includes('START') ||
        text.includes('EARLY RETURN')) {
      console.log(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('=== Loaded, waiting 2 seconds ===');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n=== Evaluating state BEFORE click ===');
  let state = await page.evaluate(() => {
    const audioPrompt = document.body.textContent.includes('AUDIO REQUIRED');
    return { audioPrompt };
  });
  console.log('State before click:', state);

  console.log('\n=== Clicking canvas ===');
  await page.click('canvas');
  
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n=== Evaluating state AFTER click ===');
  state = await page.evaluate(() => {
    const audioPrompt = document.body.textContent.includes('AUDIO REQUIRED');
    const startScreen = document.body.textContent.includes('PRESS ANY KEY');
    return { audioPrompt, startScreen };
  });
  console.log('State after click:', state);

  await new Promise(resolve => setTimeout(resolve, 2000));
  await browser.close();
})();
