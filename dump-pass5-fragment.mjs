import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let fragmentSource = null;

page.on('console', msg => {
  const text = msg.text();
  // Capture fragment shader compilation for pass_5
  if (text.includes('pass_5') && text.includes('Compiling fragment')) {
    const lines = text.split('\n');
    fragmentSource = lines.slice(1, 100).join('\n'); // Get first 100 lines after header
  }
});

// Expose a way to get compiled shaders
await page.exposeFunction('getShaderSource', (passName) => {
  return new Promise((resolve) => {
    const renderer = window.__pureWebGL2Renderer__;
    if (!renderer) {
      resolve({ error: 'No renderer found' });
      return;
    }
    // We can't easily get the source, but we can check what's in the compiled program
    resolve({ success: true });
  });
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

console.log('\n=== Fragment Shader Source (first 100 lines) ===');
if (fragmentSource) {
  console.log(fragmentSource);
} else {
  console.log('Fragment source not captured. Need to add logging in SlangShaderCompiler.');
}

await browser.close();
