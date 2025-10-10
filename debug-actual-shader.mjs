import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let capturedShader = null;

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('Vertex shader start:')) {
    capturedShader = 'vertex';
  } else if (capturedShader === 'vertex' && text.includes('precision highp float')) {
    // Get the actual shader content
    console.log('=== ACTUAL VERTEX SHADER (first 2000 chars) ===');
    console.log(text.substring(0, 2000));
    capturedShader = null;
  }
});

await page.goto('http://localhost:8080/slang-demo', {
  waitUntil: 'networkidle0',
  timeout: 5000
}).catch(() => {});

await new Promise(r => setTimeout(r, 2000));
await browser.close();