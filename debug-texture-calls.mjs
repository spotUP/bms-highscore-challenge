import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  let shaderCount = 0;
  const shaders = {};
  
  await page.evaluateOnNewDocument(() => {
    const originalShaderSource = WebGLRenderingContext.prototype.shaderSource;
    const originalCompileShader = WebGLRenderingContext.prototype.compileShader;
    
    let shaderMap = new Map();
    
    WebGLRenderingContext.prototype.shaderSource = function(shader, source) {
      shaderMap.set(shader, source);
      
      // Check for texture() calls and log first shader with them
      if (source.includes('texture(') && !window.textureShaderLogged) {
        const lines = source.split('\n');
        
        // Find version directive
        const versionLine = lines.find(l => l.includes('#version'));
        console.log('SHADER_VERSION:', versionLine || 'NO VERSION');
        
        // Find sampler declarations
        const samplers = lines.filter(l => l.includes('uniform sampler'));
        if (samplers.length > 0) {
          console.log('SAMPLER_COUNT:', samplers.length);
          samplers.slice(0, 3).forEach(s => console.log('SAMPLER:', s.trim()));
        }
        
        // Find texture() calls
        const textureCalls = lines.filter(l => l.includes('texture('));
        if (textureCalls.length > 0) {
          console.log('TEXTURE_CALL_COUNT:', textureCalls.length);
          textureCalls.slice(0, 3).forEach(t => console.log('TEXTURE_CALL:', t.trim()));
        }
        
        window.textureShaderLogged = true;
      }
      
      return originalShaderSource.call(this, shader, source);
    };
    
    WebGLRenderingContext.prototype.compileShader = function(shader) {
      const result = originalCompileShader.call(this, shader);
      
      if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
        const error = this.getShaderInfoLog(shader);
        const source = shaderMap.get(shader);
        
        if (error && error.includes("'texture'") && !window.textureErrorLogged) {
          const lines = source ? source.split('\n') : [];
          
          // Get the error line
          const match = error.match(/ERROR: 0:(\d+):/);
          if (match) {
            const lineNum = parseInt(match[1]) - 1;
            console.log('TEXTURE_ERROR_LINE:', lineNum + 1);
            if (lines[lineNum]) {
              console.log('ERROR_CODE:', lines[lineNum].trim());
              
              // Check around the error
              for (let i = Math.max(0, lineNum - 2); i <= Math.min(lines.length - 1, lineNum + 2); i++) {
                console.log('CONTEXT_LINE_' + (i + 1) + ':', lines[i].trim());
              }
            }
          }
          
          window.textureErrorLogged = true;
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
    if (text.includes('SHADER_VERSION') || text.includes('SAMPLER') || text.includes('TEXTURE_') || text.includes('ERROR_') || text.includes('CONTEXT_LINE')) {
      logs.push(text);
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 10000));
  } catch (e) {}

  console.log('=== TEXTURE DEBUG ANALYSIS ===');
  logs.forEach(log => console.log(log));

  await browser.close();
})();
