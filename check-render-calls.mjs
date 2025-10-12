import puppeteer from 'puppeteer';

console.log('🔍 Checking if render function is being called...\n');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let renderCalls = 0;
let beginFrameCalls = 0;
let endFrameCalls = 0;
let gameLoopCalls = 0;

page.on('console', msg => {
  const text = msg.text();

  if (text.includes('[RENDER START]')) {
    renderCalls++;
    if (renderCalls <= 3) {
      console.log(`✓ Render call #${renderCalls}`);
    }
  }

  if (text.includes('[BEGIN FRAME]')) {
    beginFrameCalls++;
    if (beginFrameCalls <= 3) {
      console.log(`✓ beginFrame call #${beginFrameCalls}`);
    }
  }

  if (text.includes('[END FRAME]')) {
    endFrameCalls++;
    if (endFrameCalls <= 3) {
      console.log(`✓ endFrame call #${endFrameCalls}`);
    }
  }

  if (text.includes('[GAME LOOP]')) {
    gameLoopCalls++;
    if (gameLoopCalls <= 3) {
      console.log(`✓ gameLoop call #${gameLoopCalls}`);
    }
  }

  // Show critical errors
  if (text.includes('ERROR') || text.includes('failed')) {
    console.log('❌', text);
  }
});

console.log('📡 Loading game...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

console.log('⏱️  Waiting 3 seconds for rendering...');
await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n' + '='.repeat(60));
console.log('📊 RENDER CALL STATISTICS');
console.log('='.repeat(60));
console.log('Game loop calls:', gameLoopCalls);
console.log('Render calls:', renderCalls);
console.log('beginFrame calls:', beginFrameCalls);
console.log('endFrame calls:', endFrameCalls);

console.log('\n' + '='.repeat(60));

if (renderCalls > 0 && beginFrameCalls > 0 && endFrameCalls > 0) {
  console.log('✅ SUCCESS: All render functions are being called!');
} else {
  console.log('❌ FAILURE: Some render functions are NOT being called:');
  if (gameLoopCalls === 0) console.log('  - Game loop is NOT running');
  if (renderCalls === 0) console.log('  - Render function is NOT being called');
  if (beginFrameCalls === 0) console.log('  - beginFrame() is NOT being called');
  if (endFrameCalls === 0) console.log('  - endFrame() is NOT being called');
}

console.log('='.repeat(60));

await browser.close();
