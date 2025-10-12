import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let errors = [];
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('ERROR') || text.includes('undeclared') || text.includes('bypass')) {
    errors.push(text);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

// Check if shaders are working
const status = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };

  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'No WebGL2' };

  // Read center pixel
  const pixels = new Uint8Array(4);
  gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  return {
    pixel: Array.from(pixels),
    canvasSize: `${canvas.width}x${canvas.height}`,
    isBlack: pixels[0] === 0 && pixels[1] === 0 && pixels[2] === 0
  };
});

console.log('\n=== Current Status ===');
console.log(JSON.stringify(status, null, 2));

if (errors.length > 0) {
  console.log('\n=== Errors Found ===');
  errors.forEach(e => console.log(e));
}

await browser.close();
