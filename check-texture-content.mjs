import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Inject code to read texture pixels
await page.evaluateOnNewDocument(() => {
  window.checkTextureContent = function() {
    // Find the renderer instance
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      console.log('[TEX CHECK] No canvas found');
      return;
    }

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.log('[TEX CHECK] No WebGL2 context');
      return;
    }

    // Try to access the texture through the window
    if (window.__webgl2d__ && window.__webgl2d__.framebufferTexture) {
      const texture = window.__webgl2d__.framebufferTexture;
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

      const pixels = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      console.log(`[TEX CHECK] gameTexture pixel (0,0): rgb(${pixels[0]}, ${pixels[1]}, ${pixels[2]}), a=${pixels[3]}`);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
    } else {
      console.log('[TEX CHECK] Cannot access framebufferTexture');
    }
  };
});

// Capture console logs
page.on('console', msg => console.log(msg.text()));

await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded' });

// Wait for game to start
await page.waitForTimeout(3000);

// Check texture content
await page.evaluate(() => {
  if (window.checkTextureContent) {
    window.checkTextureContent();
  }
});

await browser.close();
console.log('\n✅ Check complete');
