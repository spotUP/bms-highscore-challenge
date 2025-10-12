import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let compiledShaders = [];

page.on('console', msg => {
  const text = msg.text();
  // Capture compiled shader source
  if (text.includes('[COMPILED FRAGMENT]') || text.includes('[COMPILED VERTEX]')) {
    compiledShaders.push(text);
  }
});

console.log('Loading page...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

console.log('\n=== Compiled Shader Sources ===\n');
if (compiledShaders.length > 0) {
  compiledShaders.slice(0, 10).forEach(shader => console.log(shader));
} else {
  console.log('No compiled shaders captured. Enable debug logging in SlangShaderCompiler.');
}

await browser.close();
