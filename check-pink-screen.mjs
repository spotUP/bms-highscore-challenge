import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleMessages = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
  });

  page.on('pageerror', error => {
    consoleMessages.push(`[PAGE ERROR] ${error.message}`);
  });

  console.log('Loading game to diagnose pink screen...');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('Waiting 8 seconds...');
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Take screenshot
  await page.screenshot({
    path: '/tmp/pink-screen-debug.jpg',
    type: 'jpeg',
    quality: 80
  });

  // Filter for shader-related messages
  const shaderMessages = consoleMessages.filter(msg =>
    msg.includes('shader') ||
    msg.includes('pass') ||
    msg.includes('ERROR') ||
    msg.includes('WebGL') ||
    msg.includes('Compilation') ||
    msg.includes('Bypassing') ||
    msg.includes('Failed')
  );

  console.log('\n' + '='.repeat(80));
  console.log('PINK SCREEN DIAGNOSTIC');
  console.log('='.repeat(80));
  console.log(`\nTotal messages: ${consoleMessages.length}`);
  console.log(`Shader-related: ${shaderMessages.length}`);

  console.log('\nALL SHADER MESSAGES:');
  shaderMessages.forEach(msg => console.log(msg));

  console.log('\nScreenshot: /tmp/pink-screen-debug.jpg');
  console.log('='.repeat(80) + '\n');

  await browser.close();
})();
