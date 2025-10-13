import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const pass4Logs = [];
  let capturingPass4 = false;

  page.on('console', msg => {
    const text = msg.text();

    // Start capturing when we see pass_4 loading
    if (text.includes('pass_4') && text.includes('hsm-pre-shaders')) {
      capturingPass4 = true;
      console.log('\n🎯 FOUND PASS_4 COMPILATION - Capturing logs...\n');
    }

    // Capture all logs while we're in pass_4 compilation
    if (capturingPass4) {
      pass4Logs.push(text);
      console.log(text);

      // Stop after we see the compiled result
      if (text.includes('[PureWebGL2MultiPass] Compiled pass_4')) {
        capturingPass4 = false;
        console.log('\n✅ PASS_4 COMPILATION COMPLETE\n');
      }
    }
  });

  try {
    await page.goto('http://localhost:8080/pong', { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.log('Error or timeout:', error.message);
  } finally {
    await browser.close();
    console.log(`\nCaptured ${pass4Logs.length} log lines for pass_4`);
  }
})();
