import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let vertexShaderCode = null;
let fragmentShaderCode = null;

// Set up console logging to capture shader code
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[DirectWebGLCompiler] Compiling vertex shader')) {
    const codeMatch = text.match(/\[DirectWebGLCompiler\] Compiling vertex shader:\s*([\s\S]*)/);
    if (codeMatch) {
      vertexShaderCode = codeMatch[1];
      console.log('=== CAPTURED VERTEX SHADER ===');
      // Only print first 50 lines containing v_ declarations or redefinitions
      const lines = vertexShaderCode.split('\n');
      let count = 0;
      for (let i = 0; i < lines.length && count < 50; i++) {
        if (lines[i].includes('v_') || lines[i].includes('Global-to-varying')) {
          console.log(`Line ${i}: ${lines[i]}`);
          count++;
        }
      }
    }
  }
});

console.log('Loading shader demo...');
await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle2' });

// Wait for shader compilation messages
await page.waitForTimeout(3000);

await browser.close();