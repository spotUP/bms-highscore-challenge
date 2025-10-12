import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };
  
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'No WebGL2' };
  
  const w = canvas.width;
  const h = canvas.height;
  
  // Sample multiple points
  const samples = [
    { name: 'center', x: w/2, y: h/2 },
    { name: 'top-left', x: w/4, y: h/4 },
    { name: 'top-right', x: 3*w/4, y: h/4 },
    { name: 'bottom-left', x: w/4, y: 3*h/4 },
    { name: 'bottom-right', x: 3*w/4, y: 3*h/4 }
  ];
  
  const results = {};
  for (const s of samples) {
    const pixels = new Uint8Array(4);
    gl.readPixels(Math.floor(s.x), Math.floor(s.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    results[s.name] = Array.from(pixels);
  }
  
  return {
    canvasSize: `${w}x${h}`,
    samples: results
  };
});

console.log('\n=== Shader Output Sampling ===');
console.log(JSON.stringify(info, null, 2));

await browser.close();
