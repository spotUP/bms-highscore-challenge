import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  let firstShader = true;
  
  await page.evaluateOnNewDocument(() => {
    const originalShaderSource = WebGLRenderingContext.prototype.shaderSource;
    
    WebGLRenderingContext.prototype.shaderSource = function(shader, source) {
      if (window.shaderCount === undefined) window.shaderCount = 0;
      window.shaderCount++;
      
      if (window.shaderCount === 1) {
        const lines = source.split('\n');
        console.log('=== FIRST SHADER FIRST 5 LINES ===');
        for (let i = 0; i < Math.min(5, lines.length); i++) {
          console.log('Line', (i+1) + ':', lines[i]);
        }
      }
      
      return originalShaderSource.call(this, shader, source);
    };
    
    // Also for WebGL2
    if (window.WebGL2RenderingContext) {
      WebGL2RenderingContext.prototype.shaderSource = WebGLRenderingContext.prototype.shaderSource;
    }
  });
  
  const logs = [];
  page.on('console', msg => {
    if (msg.text().includes('FIRST SHADER') || msg.text().includes('Line ')) {
      logs.push(msg.text());
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (e) {}

  logs.forEach(log => console.log(log));

  await browser.close();
})();
