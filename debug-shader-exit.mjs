import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Use visible browser to match your environment
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Track specific messages
  let shaderExitDetected = false;
  let lastEndFrameMessage = null;
  let skipMessages = [];
  let errorMessages = [];

  page.on('console', msg => {
    const text = msg.text();

    // Track endFrame messages
    if (text.includes('[endFrame] Frame')) {
      lastEndFrameMessage = text;
    }

    // Track SKIP messages
    if (text.includes('SKIP duplicate endFrame')) {
      skipMessages.push(text);
    }

    // Track errors and condition failures
    if (text.includes('endFrame() called without beginFrame()') ||
        text.includes('Bypassing shaders') ||
        text.includes('SHADER DISABLED') ||
        text.includes('SHADER CONDITION FAILED')) {
      errorMessages.push(text);
    }

    // Track passthrough (indicates shader not rendering)
    if (text.includes('PASSTHROUGH') && text.includes('enabled=false')) {
      shaderExitDetected = true;
    }
  });

  console.log('Loading game...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('Monitoring for 20 seconds (to see transition)...\n');
  await new Promise(resolve => setTimeout(resolve, 20000));

  // Check shader state
  const shadersEnabled = await page.evaluate(() => {
    return window.webglShaderWrapper?.shadersEnabled;
  });

  const shadersFailed = await page.evaluate(() => {
    return window.webglShaderWrapper?.shadersFailed;
  });

  const hasRenderer = await page.evaluate(() => {
    return !!window.webglShaderWrapper?.shaderRenderer;
  });

  console.log('='.repeat(80));
  console.log('SHADER STATE AFTER 15 SECONDS');
  console.log('='.repeat(80));
  console.log('shadersEnabled:', shadersEnabled);
  console.log('shadersFailed:', shadersFailed);
  console.log('hasRenderer:', hasRenderer);
  console.log('\nLast endFrame message:');
  console.log(lastEndFrameMessage || 'None');
  console.log('\nTotal SKIP duplicate messages:', skipMessages.length);
  if (skipMessages.length > 0) {
    console.log('First SKIP:', skipMessages[0]);
    console.log('Last SKIP:', skipMessages[skipMessages.length - 1]);
  }
  console.log('\nErrors detected:', errorMessages.length);
  if (errorMessages.length > 20) {
    console.log('First 10:');
    errorMessages.slice(0, 10).forEach(err => console.log('  ', err));
    console.log('...');
    console.log('Last 10:');
    errorMessages.slice(-10).forEach(err => console.log('  ', err));
  } else {
    errorMessages.forEach(err => console.log('  ', err));
  }
  console.log('\nShader exit detected (enabled=false):', shaderExitDetected);
  console.log('='.repeat(80));

  await browser.close();
})();
