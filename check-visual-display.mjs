import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let errors = [];

page.on('console', msg => {
  const text = msg.text();
  if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
    errors.push(text);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

// Press space to start game
await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 2000));

const displayInfo = await page.evaluate(() => {
  const canvases = document.querySelectorAll('canvas');
  const results = [];
  
  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const rect = canvas.getBoundingClientRect();
    const style = window.getComputedStyle(canvas);
    
    results.push({
      index: i,
      id: canvas.id || 'no-id',
      className: canvas.className || 'no-class',
      size: canvas.width + 'x' + canvas.height,
      position: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      },
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      zIndex: style.zIndex
    });
  }
  
  return results;
});

console.log('\n=== Canvas Display Info ===');
console.log(JSON.stringify(displayInfo, null, 2));

console.log('\n=== Errors ===');
if (errors.length > 0) {
  errors.slice(0, 5).forEach(e => console.log(e));
}

// Take a screenshot
await page.screenshot({ path: '/tmp/pong-display.jpeg', type: 'jpeg', quality: 90 });
console.log('\nScreenshot saved to /tmp/pong-display.jpeg');

await browser.close();
