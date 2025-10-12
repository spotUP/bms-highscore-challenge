import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1920,1080'] });
const page = await browser.newPage();

const allLogs = [];
let shaderFrameCount = 0;
let noShaderFrameCount = 0;
let errors = [];
let warnings = [];

page.on('console', msg => {
  const text = msg.text();
  const type = msg.type();
  
  allLogs.push({ type, text });
  
  // Track shader rendering
  if (text.includes('[SHADER] Rendering WITH shader')) {
    shaderFrameCount++;
  }
  if (text.includes('[SHADER] Rendering WITHOUT shader')) {
    noShaderFrameCount++;
  }
  
  // Track errors and warnings
  if (type === 'error' || text.includes('❌') || text.includes('ERROR')) {
    errors.push(text);
    console.log('❌ ERROR:', text);
  }
  if (type === 'warning' || text.includes('⚠️') || text.includes('WARN')) {
    warnings.push(text);
  }
  
  // Show critical logs
  if (text.includes('SHADER') || text.includes('beginFrame') || text.includes('endFrame') || 
      text.includes('MULTI-PASS') || text.includes('framebuffer') || text.includes('PureWebGL2MultiPass')) {
    console.log(text);
  }
});

page.on('pageerror', error => {
  errors.push(error.message);
  console.log('❌ PAGE ERROR:', error.message);
});

console.log('🌐 Loading game...\n');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

console.log('⏳ Waiting 8 seconds for rendering...\n');
await new Promise(resolve => setTimeout(resolve, 8000));

// Analyze what's actually being rendered
const renderingState = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'No canvas' };
  
  // Check WebGL state
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'No WebGL2 context' };
  
  // Check current framebuffer binding
  const currentFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  
  // Check viewport
  const viewport = gl.getParameter(gl.VIEWPORT);
  
  // Check if canvas is visible
  const rect = canvas.getBoundingClientRect();
  
  return {
    canvasSize: { width: canvas.width, height: canvas.height },
    canvasVisible: rect.width > 0 && rect.height > 0,
    viewport: Array.from(viewport),
    framebufferBound: currentFramebuffer !== null,
    canvasRect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left }
  };
});

console.log('\n=== ANALYSIS ===');
console.log('Total console logs:', allLogs.length);
console.log('Shader frames logged:', shaderFrameCount);
console.log('Non-shader frames logged:', noShaderFrameCount);
console.log('Errors:', errors.length);
console.log('Warnings:', warnings.length);
console.log('\nCanvas state:', JSON.stringify(renderingState, null, 2));

// Check for specific issues
const hasBeginFrame = allLogs.some(l => l.text.includes('beginFrame'));
const hasEndFrame = allLogs.some(l => l.text.includes('endFrame'));
const hasShaderInit = allLogs.some(l => l.text.includes('Mega Bezel shaders initialized'));
const hasPresetLoaded = allLogs.some(l => l.text.includes('Preset loaded successfully'));
const hasFirstFrame = allLogs.some(l => l.text.includes('First frame rendered'));
const hasMultiPass = allLogs.some(l => l.text.includes('Executing') && l.text.includes('passes'));

console.log('\n=== CRITICAL CHECKS ===');
console.log('✓ Shader init:', hasShaderInit);
console.log('✓ Preset loaded:', hasPresetLoaded);
console.log('✓ First frame:', hasFirstFrame);
console.log('✓ Multi-pass rendering:', hasMultiPass);
console.log('✓ beginFrame called:', hasBeginFrame);
console.log('✓ endFrame called:', hasEndFrame);
console.log('✓ Shader frames rendered:', shaderFrameCount > 0);

if (errors.length > 0) {
  console.log('\n=== ERRORS FOUND ===');
  errors.slice(0, 5).forEach((e, i) => console.log(`${i+1}. ${e}`));
}

// Look for the smoking gun
const renderingLogs = allLogs.filter(l => l.text.includes('[SHADER]'));
if (renderingLogs.length > 0) {
  console.log('\n=== SHADER RENDERING LOGS (first 5) ===');
  renderingLogs.slice(0, 5).forEach(l => console.log(l.text));
}

console.log('\n✅ Analysis complete. Check the browser window to see if shaders are visible.');

await new Promise(resolve => setTimeout(resolve, 5000));
await browser.close();
