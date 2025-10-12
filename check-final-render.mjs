import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let allLogs = [];

page.on('console', msg => {
  allLogs.push(msg.text());
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 2000));

// Check render state
const state = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };
  
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'No WebGL2' };
  
  // Read multiple pixels
  const pixels = new Uint8Array(16);
  gl.readPixels(canvas.width/2 - 2, canvas.height/2 - 2, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  
  return {
    canvasSize: canvas.width + 'x' + canvas.height,
    centerRegion: Array.from(pixels),
    allBlack: pixels.every(v => v === 0 || v === 255)
  };
});

console.log('\n=== Render State ===');
console.log(JSON.stringify(state, null, 2));

// Find relevant logs
const renderLogs = allLogs.filter(log => 
  log.includes('pass_5') || 
  log.includes('final') ||
  log.includes('Drawing') ||
  log.includes('screen')
);

console.log('\n=== Recent Render Logs ===');
renderLogs.slice(-5).forEach(log => console.log(log));

await browser.close();
