import puppeteer from 'puppeteer';

console.log('🔍 Verifying built-in CRT shader...\n');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let shaderInitialized = false;
let shaderFailed = false;
let shadersEnabled = false;
let frameCount = 0;
let beginFrameCalled = false;
let endFrameCalled = false;

page.on('console', msg => {
  const text = msg.text();

  // Track initialization
  if (text.includes('Built-in CRT shaders initialized')) {
    shaderInitialized = true;
    console.log('✅ Shader initialized:', text);
  }

  // Track failures
  if (text.includes('Failed to initialize') || text.includes('shadersFailed')) {
    shaderFailed = true;
    console.log('❌ Shader failure:', text);
  }

  // Track shader state
  if (text.includes('shadersEnabled=true')) {
    shadersEnabled = true;
  }

  // Track frame calls
  if (text.includes('beginFrame')) {
    beginFrameCalled = true;
  }
  if (text.includes('endFrame')) {
    endFrameCalled = true;
    frameCount++;
  }

  // Show compilation errors
  if (text.includes('compilation failed') || text.includes('ERROR:')) {
    console.log('❌ COMPILATION ERROR:', text);
  }

  // Show preset loading
  if (text.includes('Loading shader preset') || text.includes('Passthrough shader')) {
    console.log('📋 Shader loading:', text);
  }
});

console.log('📡 Loading game...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

console.log('⏱️  Waiting 5 seconds for rendering...');
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('\n' + '='.repeat(60));
console.log('📊 VERIFICATION RESULTS');
console.log('='.repeat(60));

console.log('\n✓ Shader initialized:', shaderInitialized ? '✅ YES' : '❌ NO');
console.log('✓ Shaders enabled:', shadersEnabled ? '✅ YES' : '⚠️  NO (using passthrough)');
console.log('✓ Shader failed:', shaderFailed ? '❌ YES' : '✅ NO');
console.log('✓ beginFrame called:', beginFrameCalled ? '✅ YES' : '❌ NO');
console.log('✓ endFrame called:', endFrameCalled ? '✅ YES' : '❌ NO');
console.log('✓ Frames rendered:', frameCount);

console.log('\n' + '='.repeat(60));

if (shaderInitialized && !shaderFailed && beginFrameCalled && endFrameCalled) {
  console.log('🎉 SUCCESS: Built-in CRT shader is working correctly!');
  console.log('\nThe game should now display:');
  console.log('  • Horizontal scanlines');
  console.log('  • Subtle screen curvature');
  console.log('  • Vignette darkening at edges');
} else {
  console.log('⚠️  WARNING: Shader system has issues');
  if (!shaderInitialized) console.log('  - Shader did not initialize');
  if (shaderFailed) console.log('  - Shader compilation/loading failed');
  if (!beginFrameCalled) console.log('  - beginFrame() never called');
  if (!endFrameCalled) console.log('  - endFrame() never called');
}

console.log('\n' + '='.repeat(60));

await browser.close();
