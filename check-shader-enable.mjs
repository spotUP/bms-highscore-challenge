import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();

    // Track shader loading/enabling
    if (text.includes('Loading shader preset') ||
        text.includes('shadersEnabled') ||
        text.includes('Preset loaded') ||
        text.includes('State check') ||
        text.includes('Executing pass')) {
      console.log(`📋 ${text}`);
    }

    if (msg.type() === 'error' && !text.includes('AudioContext')) {
      console.log(`❌ ${text.substring(0, 150)}`);
    }
  });

  console.log('🎮 Opening http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('⏳ Waiting 15 seconds for preset to load...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 15000)));

  console.log('\n👀 Browser staying open. Check logs above.');
  await new Promise(() => {});
})();
