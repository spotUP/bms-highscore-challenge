import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let shaderSource = null;

page.on('console', async msg => {
  const text = msg.text();

  // Capture shader source when it's logged
  if (text.includes('[SHADER SOURCE pass_6]')) {
    const args = await Promise.all(msg.args().map(arg => arg.jsonValue()));
    if (args[1]) {
      shaderSource = args[1];
    }
  }
});

// Inject logging into SlangShaderCompiler
await page.evaluateOnNewDocument(() => {
  const originalCompile = console.log;
  window.__captureShaderSource = true;
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

// Try to extract shader from window
const shader = await page.evaluate(() => {
  // Access the renderer
  const renderer = window?.webglShaderWrapper?.renderer;
  if (!renderer) return null;

  // Get the last compiled shader (should be pass_6 with error)
  return window.__lastShaderSource || null;
});

if (shader) {
  console.log('=== PASS_6 VERTEX SHADER (first 100 lines) ===');
  const lines = shader.split('\n').slice(0, 100);
  lines.forEach((line, i) => console.log(`${i+1}: ${line}`));
} else {
  console.log('Could not extract shader source');
}

await browser.close();
