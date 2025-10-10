import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Set up console logging
page.on('console', msg => {
  const text = msg.text();
  // Look for key shader status messages
  if (text.includes('Failure analysis') ||
      text.includes('Reporting') ||
      text.includes('render') ||
      text.includes('shader compilation') ||
      text.includes('WebGL ERROR')) {
    console.log(text);
  }
});

// Navigate to the page
console.log('Loading shader demo...');
await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle2' });

// Wait for shader compilation messages
await page.waitForTimeout(3000);

// Check for debug overlay text
const debugText = await page.evaluate(() => {
  const overlay = document.querySelector('.debug-overlay');
  return overlay ? overlay.textContent : 'No debug overlay found';
});

console.log('Debug overlay:', debugText);

await browser.close();