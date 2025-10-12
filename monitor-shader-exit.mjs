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
    consoleMessages.push(text);

    // Real-time monitoring of shader status
    if (text.includes('shadersEnabled=false') || text.includes('Bypassing')) {
      console.log('🔴 SHADER DISABLED:', text);
    }
  });

  console.log('Loading game and monitoring for shader exit...');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('Clicking to start game...');
  await page.click('body');

  console.log('Monitoring for 20 seconds...\n');

  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check current shader status
    const recentMessages = consoleMessages.slice(-10);
    const hasEnabled = recentMessages.some(m => m.includes('shadersEnabled=true'));
    const hasDisabled = recentMessages.some(m => m.includes('shadersEnabled=false'));
    const hasBypass = recentMessages.some(m => m.includes('Bypassing'));

    if (hasBypass || hasDisabled) {
      console.log(`⚠️  Second ${i + 1}: Shader DISABLED detected`);

      // Find the error
      const errors = consoleMessages.filter(m =>
        m.includes('ERROR') ||
        m.includes('Failed') ||
        m.includes('Bypassing')
      );

      console.log('\nErrors found:');
      errors.slice(-5).forEach(err => console.log('  ', err));
      break;
    } else if (hasEnabled) {
      process.stdout.write(`✓ Second ${i + 1}: Shaders active\r`);
    }
  }

  console.log('\n\nDone monitoring.');
  await browser.close();
})();
