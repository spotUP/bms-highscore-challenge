import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  let capturedShaders = {
    vertex: null,
    fragment: null
  };
  
  // Intercept shader compilation
  await page.evaluateOnNewDocument(() => {
    const originalCompileShader = WebGLRenderingContext.prototype.compileShader;
    const originalShaderSource = WebGLRenderingContext.prototype.shaderSource;
    
    let lastVertex = '';
    let lastFragment = '';
    
    WebGLRenderingContext.prototype.shaderSource = function(shader, source) {
      const shaderType = this.getShaderParameter(shader, this.SHADER_TYPE);
      if (shaderType === this.VERTEX_SHADER) {
        lastVertex = source;
        if (source.includes('texture(') && !window.vertexCaptured) {
          console.log('=== VERTEX SHADER WITH texture() ===');
          // Find lines around texture() calls
          const lines = source.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('texture(')) {
              console.log('Line', (i+1) + ':', lines[i].trim());
              // Show context
              if (i > 0) console.log('  prev:', lines[i-1].trim());
              if (i < lines.length - 1) console.log('  next:', lines[i+1].trim());
              break;
            }
          }
          window.vertexCaptured = true;
        }
      } else if (shaderType === this.FRAGMENT_SHADER) {
        lastFragment = source;
      }
      return originalShaderSource.call(this, shader, source);
    };
    
    WebGLRenderingContext.prototype.compileShader = function(shader) {
      const result = originalCompileShader.call(this, shader);
      if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
        const error = this.getShaderInfoLog(shader);
        const shaderType = this.getShaderParameter(shader, this.SHADER_TYPE);
        
        if (error && error.includes("'texture'") && error.includes('no matching')) {
          const errorMatch = error.match(/ERROR: 0:(\d+):/);
          if (errorMatch) {
            const lineNum = parseInt(errorMatch[1]) - 1;
            const source = shaderType === this.VERTEX_SHADER ? lastVertex : lastFragment;
            const lines = source.split('\n');
            
            console.log('=== TEXTURE ERROR at line', lineNum + 1, '===');
            if (lines[lineNum]) {
              console.log('ERROR LINE:', lines[lineNum].trim());
              
              // Look for sampler declarations
              for (let i = 0; i < Math.min(100, lines.length); i++) {
                if (lines[i].includes('uniform sampler')) {
                  console.log('SAMPLER at line', (i+1) + ':', lines[i].trim());
                }
              }
            }
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
    const text = msg.text();
    if (text.includes('VERTEX SHADER') || text.includes('TEXTURE ERROR') || text.includes('SAMPLER') || text.includes('Line')) {
      logs.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  logs.forEach(log => console.log(log));

  await browser.close();
})();
