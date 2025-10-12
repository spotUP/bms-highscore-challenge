import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let shaderSource = null;

  await page.evaluateOnNewDocument(() => {
    // Hook into WebGL context creation to capture shader source
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const ctx = originalGetContext.call(this, type, ...args);
      
      if (type === 'webgl2' || type === 'webgl') {
        const originalShaderSource = ctx.shaderSource;
        ctx.shaderSource = function(shader, source) {
          // Store fragment shader source when it contains bezel-related code
          if (source.includes('HSM_BG_LAYER_ORDER')) {
            window.capturedBezelShader = source;
          }
          return originalShaderSource.call(this, shader, source);
        };
      }
      
      return ctx;
    };
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2' });
  
  // Enable shaders
  await page.keyboard.press('s');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Enable Mega Bezel
  await page.keyboard.press('m');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get captured shader
  shaderSource = await page.evaluate(() => window.capturedBezelShader);

  if (shaderSource) {
    // Extract lines around 4196
    const lines = shaderSource.split('\n');
    console.log('=== Lines 4194-4200 of compiled bezel shader ===');
    for (let i = 4193; i < 4200 && i < lines.length; i++) {
      console.log(`${i+1}: ${lines[i]}`);
    }
  } else {
    console.log('No bezel shader captured');
  }

  await browser.close();
})();
