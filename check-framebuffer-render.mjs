import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Capture console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

  // Wait for canvas
  await page.waitForSelector('canvas', { timeout: 5000 });

  // Click to start audio (if needed)
  await page.click('body');

  // Wait 3 seconds for shaders to load and game to run
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get rendering status from the page
  const status = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };

    const gl = canvas.getContext('webgl2');
    if (!gl) return { error: 'No WebGL2 context' };

    // Check if framebuffer has content
    const pixels = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Sample multiple points
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(Math.random() * canvas.width);
      const y = Math.floor(Math.random() * canvas.height);
      const p = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      samples.push({x, y, rgba: Array.from(p)});
    }

    return {
      canvasSize: { width: canvas.width, height: canvas.height },
      topLeftPixel: Array.from(pixels),
      randomSamples: samples
    };
  });

  console.log('\n=== RENDERING STATUS ===');
  console.log(JSON.stringify(status, null, 2));

  // Check shader-related logs
  const shaderLogs = logs.filter(l =>
    l.includes('[Renderer]') ||
    l.includes('beginFrame') ||
    l.includes('endFrame') ||
    l.includes('Rendering pass')
  );

  console.log('\n=== SHADER LOGS (last 30) ===');
  shaderLogs.slice(-30).forEach(log => console.log(log));

  // Check if shaders loaded
  const loadedLog = logs.find(l => l.includes('shadersEnabled = true'));
  console.log('\n=== SHADER LOADED ===', !!loadedLog);

  await browser.close();
})();
