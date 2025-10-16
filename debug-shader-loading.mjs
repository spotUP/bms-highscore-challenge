import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Collect all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
  });

  // Log page errors
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  try {
    console.log('Opening http://localhost:8080/404...');
    await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check URL
    const url = page.url();
    console.log(`Current URL: ${url}`);

    // Show first 50 console messages
    console.log(`\nCapture ${consoleMessages.length} console messages:\n`);
    consoleMessages.slice(0, 50).forEach((msg, idx) => {
      console.log(`${idx + 1}. ${msg.substring(0, 200)}`);
    });

    // Check for shader-related messages
    const shaderMessages = consoleMessages.filter(m =>
      m.includes('shader') || m.includes('Shader') || m.includes('GLSL') || m.includes('WebGL')
    );

    console.log(`\n📊 ${shaderMessages.length} shader-related messages found`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
