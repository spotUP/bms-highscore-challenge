import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let gameStarted = false;
let shaderEnabled = false;
let passRendered = [];

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('Game started') || text.includes('SKIP_TO_GAMEPLAY')) {
    gameStarted = true;
  }
  if (text.includes('shader') && (text.includes('enabled') || text.includes('compil'))) {
    shaderEnabled = true;
  }
  if (text.includes('pass_') && text.includes('output')) {
    passRendered.push(text);
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

console.log('\n=== Game State ===');
console.log('Game started:', gameStarted);
console.log('Shader enabled:', shaderEnabled);
console.log('Passes rendered:', passRendered.length > 0 ? 'Yes' : 'No');
if (passRendered.length > 0) {
  console.log('Sample pass logs:', passRendered.slice(0, 3));
}

await browser.close();
