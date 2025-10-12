import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  let vertexShaderSource = null;

  page.on('console', msg => {
    const text = msg.text();

    // Look for final compiled vertex shader
    if (text.includes('[SlangCompiler] Final compiled vertex shader')) {
      // Capture next 50 console messages to get full shader
      vertexShaderSource = '';
    }

    console.log(text);
  });

  // Intercept XHR to capture compiled shader
  await page.evaluateOnNewDocument(() => {
    window.compiledShaders = [];

    const originalCompile = WebGLRenderingContext.prototype.compileShader;
    WebGLRenderingContext.prototype.compileShader = function(shader) {
      const source = this.getShaderSource(shader);
      if (source && source.length > 10000) {
        window.compiledShaders.push(source);
        console.log(`[CAPTURED] Shader source (${source.length} chars)`);
      }
      return originalCompile.call(this, shader);
    };

    const originalCompile2 = WebGL2RenderingContext.prototype.compileShader;
    WebGL2RenderingContext.prototype.compileShader = function(shader) {
      const source = this.getShaderSource(shader);
      if (source && source.length > 10000) {
        window.compiledShaders.push(source);
        console.log(`[CAPTURED] Shader source (${source.length} chars)`);
      }
      return originalCompile2.call(this, shader);
    };
  });

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.keyboard.press('s');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.keyboard.press('m');
    await new Promise(resolve => setTimeout(resolve, 8000));

    const shaders = await page.evaluate(() => window.compiledShaders);

    if (shaders && shaders.length > 0) {
      console.log(`\n📄 Found ${shaders.length} large compiled shaders`);

      // Save the last one (likely the failing pass_2 vertex shader)
      const lastShader = shaders[shaders.length - 1];
      fs.writeFileSync('/Users/spot/Code/bms-highscore-challenge/pass_2_vertex.glsl', lastShader);
      console.log(`✅ Saved last shader to pass_2_vertex.glsl (${lastShader.length} chars)`);

      // Show lines around 3151
      const lines = lastShader.split('\n');
      console.log('\n📍 Lines 3145-3165:');
      for (let i = 3145; i <= 3165 && i < lines.length; i++) {
        console.log(`${i}: ${lines[i-1]}`);
      }
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
