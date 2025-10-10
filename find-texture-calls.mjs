import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Intercept shader compilation
  await page.evaluateOnNewDocument(() => {
    const originalShaderSource = WebGLRenderingContext.prototype.shaderSource;
    const originalCompileShader = WebGLRenderingContext.prototype.compileShader;
    
    let shaderSources = {};
    let shaderCounter = 0;
    
    WebGLRenderingContext.prototype.shaderSource = function(shader, source) {
      shaderCounter++;
      shaderSources[shader.id || shaderCounter] = source;
      
      // Check for texture() calls
      if (source.includes('texture(')) {
        const lines = source.split('\n');
        const textureLines = [];
        const samplerLines = [];
        
        // Find all texture() calls
        lines.forEach((line, i) => {
          if (line.includes('texture(')) {
            textureLines.push({ num: i + 1, line: line.trim() });
          }
          if (line.includes('uniform sampler')) {
            samplerLines.push({ num: i + 1, line: line.trim() });
          }
        });
        
        if (textureLines.length > 0) {
          console.log('=== SHADER WITH texture() CALLS ===');
          console.log('Samplers:');
          samplerLines.forEach(s => console.log('  Line ' + s.num + ': ' + s.line));
          console.log('texture() calls (first 5):');
          textureLines.slice(0, 5).forEach(t => console.log('  Line ' + t.num + ': ' + t.line));
        }
      }
      
      return originalShaderSource.call(this, shader, source);
    };
    
    WebGLRenderingContext.prototype.compileShader = function(shader) {
      const result = originalCompileShader.call(this, shader);
      
      if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
        const error = this.getShaderInfoLog(shader);
        const source = shaderSources[shader.id || Object.keys(shaderSources).find(k => shaderSources[k])];
        
        if (error && error.includes("'texture'") && error.includes('no matching')) {
          const match = error.match(/ERROR: 0:(\d+):/);
          if (match && source) {
            const lineNum = parseInt(match[1]) - 1;
            const lines = source.split('\n');
            
            console.log('=== TEXTURE() ERROR ===');
            console.log('Error line ' + (lineNum + 1) + ':', lines[lineNum] ? lines[lineNum].trim() : 'N/A');
            
            // Check function context
            for (let i = Math.max(0, lineNum - 20); i < lineNum; i++) {
              if (lines[i] && (lines[i].includes('vec4') || lines[i].includes('vec3') || lines[i].includes('float')) && lines[i].includes('(')) {
                console.log('Possible function at line ' + (i + 1) + ':', lines[i].trim());
                break;
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
    logs.push(msg.text());
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  const relevantLogs = logs.filter(log => 
    log.includes('SHADER WITH texture()') || 
    log.includes('Samplers:') || 
    log.includes('texture() calls') ||
    log.includes('Line ') ||
    log.includes('TEXTURE() ERROR')
  );
  
  relevantLogs.forEach(log => console.log(log));

  await browser.close();
})();
