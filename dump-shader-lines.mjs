import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  console.log(text);
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2' });
await page.waitForTimeout(1000);

// Press space twice to start game
await page.keyboard.press('Space');
await page.waitForTimeout(100);
await page.keyboard.press('Space');
await page.waitForTimeout(500);

// Press M to enable Mega Bezel
await page.keyboard.press('m');
await page.waitForTimeout(3000);

// Get the fragment shader from pass_2
const shaderLines = await page.evaluate(() => {
  // Find error line
  const errorMatch = document.body.innerText.match(/Fragment shader compilation failed for pass_2: ERROR: 0:(\d+)/);
  if (!errorMatch) return 'No error found';
  const errorLine = parseInt(errorMatch[1]);
  
  // Get shader from console logs
  const logs = Array.from(document.querySelectorAll('.console-line')).map(el => el.innerText);
  const shaderSrc = logs.find(log => log.includes('float HSM_GetNoScanlineMode'));
  if (!shaderSrc) return 'Shader not found in console';
  
  return `Error at line ${errorLine}`;
});

console.log('\n=== SHADER ANALYSIS ===');
console.log(shaderLines);

await browser.close();
process.exit(0);
