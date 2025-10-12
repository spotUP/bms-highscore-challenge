import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    window.capturedShaders = [];
    const originalCompile = WebGL2RenderingContext.prototype.compileShader;
    WebGL2RenderingContext.prototype.compileShader = function(shader) {
      const source = this.getShaderSource(shader);
      if (source && source.includes('PassFeedback')) {
        window.capturedShaders.push({ source, length: source.length });
        console.log(`[CAPTURED] Shader with PassFeedback (${source.length} chars)`);
      }
      return originalCompile.call(this, shader);
    };
  });

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.keyboard.press('s');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.keyboard.press('m');
    await new Promise(resolve => setTimeout(resolve, 8000));

    const shaders = await page.evaluate(() => window.capturedShaders);

    if (shaders && shaders.length > 0) {
      const lastShader = shaders[shaders.length - 1];
      fs.writeFileSync('/Users/spot/Code/bms-highscore-challenge/bezel_fragment.glsl', lastShader.source);
      console.log(`Saved bezel fragment shader (${lastShader.source.length} chars)`);

      const lines = lastShader.source.split('\n');
      console.log('\nLines 3465-3475:');
      for (let i = 3465; i <= 3475 && i < lines.length; i++) {
        console.log(`${i}: ${lines[i-1]}`);
      }
    } else {
      console.log('No shaders with PassFeedback captured');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
