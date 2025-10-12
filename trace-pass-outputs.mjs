import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

// Inject code to sample each pass output
await page.evaluateOnNewDocument(() => {
  window.passOutputs = [];
  
  // Hook into WebGL to capture framebuffer after each pass
  const originalBindFramebuffer = WebGLRenderingContext.prototype.bindFramebuffer;
  const originalBindFramebuffer2 = WebGL2RenderingContext.prototype.bindFramebuffer;
  
  let passCount = 0;
  
  const sampleFramebuffer = function(gl, target, framebuffer) {
    if (window.passOutputs.length < 20 && passCount % 60 === 0) {
      try {
        // Sample center pixels
        const pixels = new Uint8Array(10 * 10 * 4);
        gl.readPixels(gl.drawingBufferWidth / 2 - 5, gl.drawingBufferHeight / 2 - 5, 10, 10, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        let nonBlack = 0;
        let sumR = 0, sumG = 0, sumB = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 10 || pixels[i+1] > 10 || pixels[i+2] > 10) {
            nonBlack++;
            sumR += pixels[i];
            sumG += pixels[i+1];
            sumB += pixels[i+2];
          }
        }
        
        const avgR = nonBlack > 0 ? Math.round(sumR / nonBlack) : 0;
        const avgG = nonBlack > 0 ? Math.round(sumG / nonBlack) : 0;
        const avgB = nonBlack > 0 ? Math.round(sumB / nonBlack) : 0;
        
        window.passOutputs.push({
          pass: window.passOutputs.length,
          color: `rgb(${avgR}, ${avgG}, ${avgB})`,
          nonBlack: nonBlack,
          total: 100
        });
      } catch (e) {
        // Ignore errors
      }
    }
    passCount++;
  };
  
  WebGL2RenderingContext.prototype.bindFramebuffer = function(target, framebuffer) {
    sampleFramebuffer(this, target, framebuffer);
    return originalBindFramebuffer2.call(this, target, framebuffer);
  };
});

console.log('🔍 Loading page...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

console.log('⏳ Waiting 5 seconds for rendering...');
await new Promise(r => setTimeout(r, 5000));

// Get pass outputs
const passOutputs = await page.evaluate(() => window.passOutputs);

console.log('\n📊 Pass-by-Pass Framebuffer Trace:');
if (passOutputs && passOutputs.length > 0) {
  passOutputs.forEach((output, i) => {
    const indicator = output.nonBlack > 0 ? '✅' : '❌';
    console.log(`  ${indicator} Pass ${i}: ${output.color} (${output.nonBlack}/${output.total} non-black pixels)`);
  });
  
  // Find where it turns black
  const firstBlack = passOutputs.findIndex(o => o.nonBlack === 0);
  if (firstBlack > 0) {
    console.log(`\n⚠️  TURNS BLACK AT PASS ${firstBlack}!`);
    console.log(`   Last good: Pass ${firstBlack - 1}: ${passOutputs[firstBlack - 1].color}`);
  }
} else {
  console.log('  ❌ No pass outputs captured');
}

await browser.close();
