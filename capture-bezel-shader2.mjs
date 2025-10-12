import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let shaderSource = null;

  await page.evaluateOnNewDocument(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const ctx = originalGetContext.call(this, type, ...args);
      
      if (type === 'webgl2' || type === 'webgl') {
        const originalShaderSource = ctx.shaderSource;
        ctx.shaderSource = function(shader, source) {
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
  await page.keyboard.press('s');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.keyboard.press('m');
  await new Promise(resolve => setTimeout(resolve, 3000));

  shaderSource = await page.evaluate(() => window.capturedBezelShader);

  if (shaderSource) {
    const lines = shaderSource.split('\n');
    console.log('=== Lines 4180-4200 showing start_layer/end_layer assignments ===');
    for (let i = 4179; i < 4200 && i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('start_layer') || line.includes('end_layer') || line.includes('for(int i')) {
        console.log(`${i+1}: ${line}`);
      }
    }
  }

  await browser.close();
})();
