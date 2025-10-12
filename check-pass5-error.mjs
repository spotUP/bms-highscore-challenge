import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let foundError = false;
let capturedShader = '';

page.on('console', msg => {
  const text = msg.text();
  
  // Capture pass_5 errors
  if (text.includes('pass_5') && text.includes('ERROR')) {
    console.log(text);
    foundError = true;
  }
  
  // Capture compiled shader for pass_5
  if (text.includes('Final compiled vertex shader') && !capturedShader) {
    setTimeout(async () => {
      const logs = await page.evaluate(() => {
        return (window as any).__lastCompiledShader || '';
      });
      if (logs) console.log('SHADER_CONTENT:', logs);
    }, 100);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForTimeout(8000);

await browser.close();
