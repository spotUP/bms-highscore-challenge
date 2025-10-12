import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

// Press spacebar to start game
await page.keyboard.press('Space');
console.log('Pressed spacebar to start game');
await new Promise(r => setTimeout(r, 2000));

// Sample pixels
const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };
  
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'No WebGL2' };
  
  const w = canvas.width;
  const h = canvas.height;
  
  // Sample left paddle area, center, right paddle area
  const samples = [];
  const pixels = new Uint8Array(4);
  
  // Left paddle (x=50, middle y)
  gl.readPixels(50, Math.floor(h/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  samples.push({ name: 'left-paddle', color: Array.from(pixels) });
  
  // Center (ball area)
  gl.readPixels(Math.floor(w/2), Math.floor(h/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  samples.push({ name: 'center', color: Array.from(pixels) });
  
  // Right paddle
  gl.readPixels(w-50, Math.floor(h/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  samples.push({ name: 'right-paddle', color: Array.from(pixels) });
  
  return { canvasSize: \`\${w}x\${h}\`, samples };
});

console.log('\\n=== After Game Start ===');
console.log(JSON.stringify(info, null, 2));

// Check if any pixels are non-black
const hasColor = info.samples.some(s => s.color[0] > 0 || s.color[1] > 0 || s.color[2] > 0);
console.log('\\nHas non-black pixels:', hasColor);

await browser.close();
