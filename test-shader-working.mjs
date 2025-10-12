import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

// Press spacebar to start
await page.keyboard.press('Space');
console.log('Started game with spacebar');
await new Promise(r => setTimeout(r, 2000));

const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };
  
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'No WebGL2' };
  
  const w = canvas.width;
  const h = canvas.height;
  
  const samples = [];
  const pixels = new Uint8Array(4);
  
  // Sample 3 points
  gl.readPixels(50, Math.floor(h/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  samples.push({ name: 'left', color: Array.from(pixels) });
  
  gl.readPixels(Math.floor(w/2), Math.floor(h/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  samples.push({ name: 'center', color: Array.from(pixels) });
  
  gl.readPixels(w-50, Math.floor(h/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  samples.push({ name: 'right', color: Array.from(pixels) });
  
  return { size: w + 'x' + h, samples };
});

console.log(JSON.stringify(info, null, 2));

const hasColor = info.samples.some(s => s.color[0] > 0 || s.color[1] > 0 || s.color[2] > 0);
console.log('\nRendering content:', hasColor ? 'YES' : 'NO (all black)');

await browser.close();
