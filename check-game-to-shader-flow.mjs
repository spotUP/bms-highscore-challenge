import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let flowLogs = [];

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[WebGL2D') ||
      text.includes('game_canvas') ||
      text.includes('Source texture') ||
      text.includes('pass_0') ||
      text.includes('copyToTexture')) {
    flowLogs.push(text);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 1000));

console.log('\n=== Game→Shader Flow Logs ===');
flowLogs.slice(0, 20).forEach(log => console.log(log));

await browser.close();
