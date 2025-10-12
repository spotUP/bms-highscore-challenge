import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let renderLogs = [];

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('Rendering pass') || 
      text.includes('final output') || 
      text.includes('to screen') ||
      text.includes('Drawing') ||
      text.includes('copyToCanvas')) {
    renderLogs.push(text);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 2000));

console.log('\n=== Render Logs (final pass to screen) ===');
if (renderLogs.length > 0) {
  renderLogs.slice(-10).forEach(log => console.log(log));
} else {
  console.log('No render-to-screen logs found');
}

// Check if WebGL2D is copying shader output to canvas
const copyStatus = await page.evaluate(() => {
  const webgl2d = (window as any).__webgl2d__;
  if (!webgl2d) return { error: 'No webgl2d instance' };
  
  return {
    hasRenderer: !!webgl2d.renderer,
    copyingToCanvas: typeof webgl2d.copyShaderOutputToCanvas === 'function',
    lastRenderTime: webgl2d.lastRenderTime || 'unknown'
  };
});

console.log('\n=== WebGL2D Copy Status ===');
console.log(JSON.stringify(copyStatus, null, 2));

await browser.close();
