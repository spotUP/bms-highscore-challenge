import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Capture console logs
const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
  console.log('[BROWSER]', text);
});

// Capture errors
page.on('pageerror', error => {
  console.log('[ERROR]', error.message);
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

// Wait for shader initialization
await new Promise(resolve => setTimeout(resolve, 3000));

// Check shader status
const shaderStatus = await page.evaluate(() => {
  const wrapper = window.webglShaderWrapper;
  if (!wrapper) return { error: 'No shader wrapper found' };

  const renderer = wrapper.multiPassRenderer;
  if (!renderer) return { error: 'No multi-pass renderer found' };

  const passes = renderer.passes || [];
  const totalPasses = passes.length;

  // Check compilation status
  const compiledPasses = passes.filter(p => p.compiled).length;

  // Check if there were any errors
  const errors = passes.filter(p => p.error).map(p => ({
    index: p.passIndex,
    error: p.error
  }));

  return {
    totalPasses,
    compiledPasses,
    errors: errors.length > 0 ? errors : 'None',
    allCompiled: totalPasses === compiledPasses,
    lastPassIndex: passes[passes.length - 1]?.passIndex
  };
});

console.log('\n📊 Shader Status:', JSON.stringify(shaderStatus, null, 2));

// Check rendering
const renderingStatus = await page.evaluate(() => {
  // Check if game is rendering
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas found' };

  const ctx = canvas.getContext('2d');
  if (!ctx) return { error: 'No 2D context' };

  // Get pixel data from center of canvas
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(w/2 - 10, h/2 - 10, 20, 20);

  let nonZeroPixels = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    if (r > 0 || g > 0 || b > 0) nonZeroPixels++;
  }

  return {
    canvasSize: `${w}x${h}`,
    sampledArea: '20x20 center',
    nonZeroPixels,
    totalPixels: 400,
    percentageNonZero: (nonZeroPixels / 400 * 100).toFixed(1) + '%',
    isBlack: nonZeroPixels < 10
  };
});

console.log('\n🎨 Rendering Status:', JSON.stringify(renderingStatus, null, 2));

// Look for specific log messages
console.log('\n📝 Key Log Messages:');
const crtLogs = logs.filter(l => l.includes('CRT') || l.includes('Pass') || l.includes('shader'));
crtLogs.slice(-20).forEach(log => console.log('  ', log));

await browser.close();
