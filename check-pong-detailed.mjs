import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/tmp/puppeteer/chrome/mac_arm-140.0.7339.185/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];
  page.on('console', async msg => {
    const text = msg.text();
    logs.push(text);
  });

  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
  });

  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle2',
    timeout: 20000
  });

  await new Promise(r => setTimeout(r, 5000));

  // Get all console logs
  console.log('=== ALL CONSOLE LOGS ===');
  logs.forEach((log, i) => {
    console.log(`${i + 1}. ${log}`);
  });

  // Check for shader-related logs
  console.log('\n=== SHADER LOGS ===');
  const shaderLogs = logs.filter(log =>
    log.toLowerCase().includes('shader') ||
    log.toLowerCase().includes('bezel') ||
    log.toLowerCase().includes('crt') ||
    log.toLowerCase().includes('fallback')
  );
  shaderLogs.forEach(log => console.log(log));

  // Check for rendering info
  const renderInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;

    // Try to get WebGL context info
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { glContext: false };

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      glContext: true,
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
    };
  });

  console.log('\n=== RENDER INFO ===');
  console.log(JSON.stringify(renderInfo, null, 2));

  await browser.close();
})();
