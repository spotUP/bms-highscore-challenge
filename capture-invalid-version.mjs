import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    const originalShaderSource = WebGLRenderingContext.prototype.shaderSource;
    const originalCompileShader = WebGLRenderingContext.prototype.compileShader;
    
    let shaderSources = new Map();
    
    WebGLRenderingContext.prototype.shaderSource = function(shader, source) {
      shaderSources.set(shader, source);
      
      // Check for invalid version
      const firstLine = source.split('\n')[0];
      if (firstLine.includes('300.0')) {
        console.log('=== FOUND INVALID VERSION ===');
        console.log('First line:', firstLine);
        const lines = source.split('\n');
        for (let i = 0; i < Math.min(10, lines.length); i++) {
          console.log('Line', (i+1) + ':', lines[i].substring(0, 100));
        }
      }
      
      return originalShaderSource.call(this, shader, source);
    };
    
    WebGLRenderingContext.prototype.compileShader = function(shader) {
      const result = originalCompileShader.call(this, shader);
      
      if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
        const error = this.getShaderInfoLog(shader);
        if (error && error.includes('300.0') && error.includes('invalid version')) {
          const source = shaderSources.get(shader);
          if (source) {
            const firstLine = source.split('\n')[0];
            console.log('=== SHADER WITH VERSION ERROR ===');
            console.log('First line:', firstLine);
          }
        }
      }
      
      return result;
    };
    
    // Also for WebGL2
    if (window.WebGL2RenderingContext) {
      WebGL2RenderingContext.prototype.shaderSource = WebGLRenderingContext.prototype.shaderSource;
      WebGL2RenderingContext.prototype.compileShader = WebGLRenderingContext.prototype.compileShader;
    }
  });
  
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 8000));
  } catch (e) {}

  const relevantLogs = logs.filter(log => 
    log.includes('INVALID VERSION') || 
    log.includes('VERSION ERROR') ||
    (log.includes('First line:') || log.includes('Line '))
  );
  
  relevantLogs.forEach(log => console.log(log));

  await browser.close();
})();
