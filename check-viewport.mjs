import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let viewportLogs = [];

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('viewport') || text.includes('Viewport') || text.includes('pass_5')) {
    viewportLogs.push(text);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 1000));

const glState = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl2');
  
  // Get current viewport
  const viewport = gl.getParameter(gl.VIEWPORT);
  
  // Get current framebuffer
  const currentFB = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  
  return {
    canvasSize: canvas.width + 'x' + canvas.height,
    viewport: Array.from(viewport),
    boundToScreen: currentFB === null
  };
});

console.log('\n=== WebGL State ===');
console.log(JSON.stringify(glState, null, 2));

console.log('\n=== Viewport Logs ===');
viewportLogs.slice(-10).forEach(log => console.log(log));

await browser.close();
