import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

const result = await page.evaluate(() => {
  const renderer = window.__webglMultiPassRenderer__;
  if (!renderer) return { error: 'No multi-pass renderer found' };
  
  // Sample last framebuffer (pass_6 output)
  const gl = renderer.gl;
  const lastPass = renderer.passes[renderer.passes.length - 1];
  if (!lastPass) return { error: 'No passes found' };
  
  // Bind and read from last framebuffer
  const fb = lastPass.framebuffer;
  if (fb) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const pixels = new Uint8Array(100 * 100 * 4);
    gl.readPixels(0, 0, 100, 100, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const avg = { r: 0, g: 0, b: 0, count: 0 };
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 0 || pixels[i+1] > 0 || pixels[i+2] > 0) {
        avg.r += pixels[i];
        avg.g += pixels[i+1];
        avg.b += pixels[i+2];
        avg.count++;
      }
    }
    if (avg.count > 0) {
      avg.r = Math.round(avg.r / avg.count);
      avg.g = Math.round(avg.g / avg.count);
      avg.b = Math.round(avg.b / avg.count);
    }
    return { lastPassOutput: avg, passes: renderer.passes.length };
  }
  
  return { error: 'No framebuffer on last pass' };
});

console.log('Pass output:', JSON.stringify(result, null, 2));

await browser.close();
