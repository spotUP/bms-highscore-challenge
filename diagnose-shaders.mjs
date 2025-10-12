import puppeteer from 'puppeteer';

console.log('🔍 Starting comprehensive shader diagnostics...\n');

const browser = await puppeteer.launch({
  headless: false,
  args: ['--window-size=1920,1080']
});

const page = await browser.newPage();

const logs = {
  initialization: [],
  compilation: [],
  rendering: [],
  errors: [],
  warnings: []
};

page.on('console', msg => {
  const text = msg.text();
  console.log(`[CONSOLE] ${text}`);

  // Categorize logs
  if (text.includes('WebGL2DWithShaders') || text.includes('[INIT]')) {
    logs.initialization.push(text);
  }
  if (text.includes('compil') || text.includes('shader') || text.includes('Slang')) {
    logs.compilation.push(text);
  }
  if (text.includes('beginFrame') || text.includes('endFrame') || text.includes('render')) {
    logs.rendering.push(text);
  }
  if (text.includes('ERROR') || text.includes('failed') || text.includes('❌')) {
    logs.errors.push(text);
  }
  if (text.includes('WARN') || text.includes('⚠️')) {
    logs.warnings.push(text);
  }
});

page.on('pageerror', error => {
  console.log(`[PAGE ERROR] ${error.message}`);
  logs.errors.push(`PAGE ERROR: ${error.message}`);
});

console.log('📡 Loading game page...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

console.log('⏱️  Waiting 5 seconds for initialization...');
await new Promise(resolve => setTimeout(resolve, 5000));

// Check if shaders are active
const shaderStatus = await page.evaluate(() => {
  return {
    hasWebGL2D: typeof window.WebGL2D !== 'undefined',
    hasWebGL2DWithShaders: typeof window.WebGL2DWithShaders !== 'undefined',
    canvasExists: !!document.querySelector('canvas'),
    canvasCount: document.querySelectorAll('canvas').length
  };
});

console.log('\n' + '='.repeat(80));
console.log('📊 DIAGNOSTIC REPORT');
console.log('='.repeat(80));

console.log('\n🎯 BROWSER ENVIRONMENT:');
console.log('  WebGL2D available:', shaderStatus.hasWebGL2D);
console.log('  WebGL2DWithShaders available:', shaderStatus.hasWebGL2DWithShaders);
console.log('  Canvas elements:', shaderStatus.canvasCount);

console.log('\n🚀 INITIALIZATION LOGS (' + logs.initialization.length + '):');
logs.initialization.forEach((log, i) => console.log(`  ${i+1}. ${log}`));

console.log('\n🔧 COMPILATION LOGS (' + logs.compilation.length + '):');
logs.compilation.forEach((log, i) => console.log(`  ${i+1}. ${log}`));

console.log('\n🎨 RENDERING LOGS (' + logs.rendering.length + '):');
logs.rendering.slice(0, 10).forEach((log, i) => console.log(`  ${i+1}. ${log}`));
if (logs.rendering.length > 10) {
  console.log(`  ... and ${logs.rendering.length - 10} more rendering logs`);
}

console.log('\n❌ ERRORS (' + logs.errors.length + '):');
if (logs.errors.length === 0) {
  console.log('  ✅ No errors detected!');
} else {
  logs.errors.forEach((log, i) => console.log(`  ${i+1}. ${log}`));
}

console.log('\n⚠️  WARNINGS (' + logs.warnings.length + '):');
if (logs.warnings.length === 0) {
  console.log('  ✅ No warnings detected!');
} else {
  logs.warnings.forEach((log, i) => console.log(`  ${i+1}. ${log}`));
}

console.log('\n' + '='.repeat(80));
console.log('🎮 VISUAL VERIFICATION');
console.log('='.repeat(80));
console.log('Check the browser window - you should see:');
console.log('  ✓ CRT scanline effects (horizontal lines)');
console.log('  ✓ Subtle screen curvature');
console.log('  ✓ Vignette darkening at edges');
console.log('\nPress Ctrl+C to exit when done checking...');

// Keep browser open for visual verification
await new Promise(resolve => setTimeout(resolve, 60000));
await browser.close();
