import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

console.log('Loading game...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

console.log('Waiting for shaders to initialize...');
await new Promise(resolve => setTimeout(resolve, 2000));

// Check shader state
const shaderState = await page.evaluate(() => {
  // Access the WebGL context through the canvas
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };
  
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'No WebGL2' };
  
  // Check what's currently bound
  const boundFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  const boundProgram = gl.getParameter(gl.CURRENT_PROGRAM);
  
  return {
    hasFramebuffer: boundFramebuffer !== null,
    hasProgram: boundProgram !== null,
    canvasSize: { width: canvas.width, height: canvas.height }
  };
});

console.log('\nShader state:', JSON.stringify(shaderState, null, 2));

console.log('\n⏳ Keeping browser open for 10 seconds - CHECK IF YOU SEE SHADER EFFECTS!');
console.log('Expected: Slight CRT scanlines, subtle curvature, derez effect');
await new Promise(resolve => setTimeout(resolve, 10000));

await browser.close();
