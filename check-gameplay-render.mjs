import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleMessages = [];

  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  console.log('Loading game...');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('Clicking to dismiss audio prompt...');
  await page.click('body');

  console.log('Waiting 5 seconds for gameplay...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Take screenshot during gameplay
  await page.screenshot({
    path: '/tmp/gameplay-with-shaders.jpg',
    type: 'jpeg',
    quality: 80
  });

  // Check shader status
  const shaderMessages = consoleMessages.filter(msg =>
    msg.includes('shadersEnabled') ||
    msg.includes('endFrame') ||
    msg.includes('Bypassing')
  );

  console.log('\n=== SHADER STATUS ===');
  console.log('Screenshot: /tmp/gameplay-with-shaders.jpg');
  console.log('\nLast 5 shader messages:');
  shaderMessages.slice(-5).forEach(msg => console.log(msg));

  await browser.close();
})();
