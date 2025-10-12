import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let vertexShaderSource = null;

page.on('console', msg => {
  const text = msg.text();
  
  // Capture the compiled vertex shader when it's about to be compiled
  if (text.includes('[PureWebGL2] Compiling vertex shader for pass_2')) {
    console.log('Found vertex shader compilation');
  }
  
  // Look for the actual shader source in logs
  if (text.includes('ERROR: 0:2004:') && text.includes('hrg_get_ideal_global_eye_pos')) {
    console.log('\n❌ ERROR AT LINE 2004:', text);
  }
});

// Intercept shader compilation to see the source
await page.evaluateOnNewDocument(() => {
  const originalCompileShader = WebGL2RenderingContext.prototype.compileShader;
  WebGL2RenderingContext.prototype.compileShader = function(shader) {
    const source = this.getShaderSource(shader);
    if (source && source.includes('hrg_get_ideal_global_eye_pos')) {
      const lines = source.split('\n');
      const line2004 = lines[2003]; // 0-indexed
      const line2003 = lines[2002];
      const line2005 = lines[2004];
      console.log('[SHADER LINE 2003]:', line2003);
      console.log('[SHADER LINE 2004]:', line2004);
      console.log('[SHADER LINE 2005]:', line2005);
      
      // Check if hrg_get_ideal_global_eye_pos function exists
      const hasFunction = source.includes('vec3 hrg_get_ideal_global_eye_pos(');
      const hasCornerMask = source.includes('float HSM_GetCornerMask(');
      console.log('[SHADER] Has hrg_get_ideal_global_eye_pos definition:', hasFunction);
      console.log('[SHADER] Has HSM_GetCornerMask definition:', hasCornerMask);
    }
    return originalCompileShader.call(this, shader);
  };
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 5000));

await browser.close();
