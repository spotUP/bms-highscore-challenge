import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

// Start game
await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 2000));

const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl2');
  const w = canvas.width;
  const h = canvas.height;
  
  // Sample a grid
  const results = {};
  const pixels = new Uint8Array(4);
  
  for (let y = 0; y < h; y += Math.floor(h/10)) {
    for (let x = 0; x < w; x += Math.floor(w/10)) {
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const key = x + ',' + y;
      const r = pixels[0], g = pixels[1], b = pixels[2];
      // Only record if it's different from the background purple
      if (r !== 26 || g !== 11 || b !== 61) {
        results[key] = [r, g, b];
      }
    }
  }
  
  return { uniqueColors: Object.keys(results).length, samples: results };
});

console.log('Unique non-background pixels found:', info.uniqueColors);
if (info.uniqueColors > 0) {
  console.log('Sample colors:', JSON.stringify(info.samples, null, 2).slice(0, 500));
} else {
  console.log('All pixels are the same purple color [26, 11, 61] - no game elements visible');
}

await browser.close();
