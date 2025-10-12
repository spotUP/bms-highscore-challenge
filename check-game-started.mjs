import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

let allLogs = [];

page.on('console', msg => {
  allLogs.push(msg.text());
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

// Press multiple keys to ensure game starts
await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 500));
await page.keyboard.press('Space');
await new Promise(r => setTimeout(r, 500));
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1500));

// Check game state
const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl2');
  
  // Sample multiple areas
  const samples = [];
  const pixels = new Uint8Array(4);
  
  for (let i = 0; i < 10; i++) {
    const x = (canvas.width / 10) * i;
    const y = canvas.height / 2;
    gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    samples.push(Array.from(pixels));
  }
  
  return { samples };
});

console.log('\n=== Pixel Samples (left to right) ===');
info.samples.forEach((s, i) => {
  const isBlack = s[0] === 0 && s[1] === 0 && s[2] === 0;
  const isPurple = s[0] === 26 && s[1] === 11 && s[2] === 61;
  console.log(`Position ${i}: [${s.join(',')}] - ${isBlack ? 'BLACK' : isPurple ? 'PURPLE BG' : 'OTHER'}`);
});

// Check for game-started logs
const gameStarted = allLogs.some(log => 
  log.includes('Game started') ||
  log.includes('Playing state') ||
  log.includes('PLAYING')
);

console.log('\n Game started:', gameStarted);

await browser.close();
