import puppeteer from 'puppeteer';

console.log('🔍 Checking shader rendering during actual gameplay...\n');

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

let renderCalls = 0;
let beginFrameCalls = 0;
let endFrameCalls = 0;

page.on('console', msg => {
  const text = msg.text();

  if (text.includes('[RENDER START]')) {
    renderCalls++;
  }

  if (text.includes('[BEGIN FRAME]')) {
    beginFrameCalls++;
    if (beginFrameCalls <= 3) {
      console.log(`✓ beginFrame #${beginFrameCalls}`);
    }
  }

  if (text.includes('[END FRAME]')) {
    endFrameCalls++;
    if (endFrameCalls <= 3) {
      console.log(`✓ endFrame #${endFrameCalls}`);
    }
  }

  if (text.includes('Built-in CRT shaders initialized')) {
    console.log('✅ Shaders initialized');
  }

  if (text.includes('ERROR') || text.includes('failed')) {
    console.log('❌', text);
  }
});

console.log('📡 Loading game...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

console.log('⏱️  Waiting for page load...');
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('🖱️  Clicking to dismiss audio prompt...');
await page.mouse.click(960, 540);
await new Promise(resolve => setTimeout(resolve, 500));

console.log('⌨️  Pressing SPACE to start game...');
await page.keyboard.press('Space');
await new Promise(resolve => setTimeout(resolve, 3000));

console.log('\n' + '='.repeat(60));
console.log('📊 IN-GAME RENDERING STATISTICS');
console.log('='.repeat(60));
console.log('Render calls:', renderCalls);
console.log('beginFrame calls:', beginFrameCalls);
console.log('endFrame calls:', endFrameCalls);

console.log('\n' + '='.repeat(60));

if (beginFrameCalls > 0 && endFrameCalls > 0 && endFrameCalls === beginFrameCalls) {
  console.log('✅ SUCCESS: Shader pipeline is working correctly!');
  console.log('\nThe CRT effects (scanlines, curvature, vignette) should be visible.');
  console.log('Check the browser window to verify visual effects.');
} else {
  console.log('❌ FAILURE: Shader pipeline has issues:');
  if (beginFrameCalls === 0) console.log('  - beginFrame() is NOT being called');
  if (endFrameCalls === 0) console.log('  - endFrame() is NOT being called');
  if (endFrameCalls !== beginFrameCalls) {
    console.log(`  - Mismatched calls: ${beginFrameCalls} beginFrame vs ${endFrameCalls} endFrame`);
  }
}

console.log('='.repeat(60));
console.log('\nKeeping browser open for visual verification...');
console.log('Press Ctrl+C to exit');

await new Promise(resolve => setTimeout(resolve, 60000));
await browser.close();
