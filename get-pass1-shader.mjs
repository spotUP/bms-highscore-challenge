import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const shaders = [];

  await page.evaluateOnNewDocument(() => {
    window.capturedShaders = [];

    const originalCompile2 = WebGL2RenderingContext.prototype.compileShader;
    WebGL2RenderingContext.prototype.compileShader = function(shader) {
      const source = this.getShaderSource(shader);
      if (source) {
        window.capturedShaders.push({ source, length: source.length });
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

    const captured = await page.evaluate(() => window.capturedShaders);

    if (captured && captured.length > 0) {
      // Find pass_1 vertex shader (likely 3rd or 4th large shader)
      const largeShaders = captured.filter(s => s.length > 50000);
      console.log(`Found ${largeShaders.length} large shaders:`);
      largeShaders.forEach((s, i) => console.log(`  ${i}: ${s.length} chars`));

      if (largeShaders.length >= 2) {
        const pass1Vertex = largeShaders[1]; // Second large shader is likely pass_1 vertex
        fs.writeFileSync('/Users/spot/Code/bms-highscore-challenge/pass_1_vertex_broken.glsl', pass1Vertex.source);
        console.log(`\nSaved pass_1 vertex shader (${pass1Vertex.source.length} chars)`);

        const lines = pass1Vertex.source.split('\n');
        console.log(`\nLines 2905-2915:`);
        for (let i = 2905; i <= 2915 && i < lines.length; i++) {
          console.log(`${i}: ${lines[i-1]}`);
        }
      }
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
