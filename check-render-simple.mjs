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
  
  const pixels = new Uint8Array(4);
  gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  
  return {
    size: `${canvas.width}x${canvas.height}`,
    centerPixel: Array.from(pixels),
    isBlack: pixels[0] === 0 && pixels[1] === 0 && pixels[2] === 0
  };
});

console.log(JSON.stringify(info, null, 2));

await browser.close();
