import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
});

console.log('🔍 Loading page...');
await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

// Check texture registration
console.log('\n📦 Texture Registration:');
const texLogs = logs.filter(l => 
  l.includes('Game texture registered') || 
  l.includes('registerTexture') ||
  l.includes('updateTexture')
);
if (texLogs.length > 0) {
  console.log(`  ✅ Found ${texLogs.length} texture operations`);
  texLogs.slice(0, 5).forEach(l => console.log('    ' + l));
} else {
  console.log('  ❌ NO TEXTURE OPERATIONS FOUND!');
}

// Check if game is rendering to canvas
console.log('\n🎮 Game Rendering:');
const renderLogs = logs.filter(l => 
  l.includes('fillRect') || 
  l.includes('Drawing') ||
  l.includes('Render called')
);
console.log(`  Found ${renderLogs.length} render operations`);

// Check shader rendering
console.log('\n🎨 Shader Rendering:');
const shaderRender = logs.filter(l => l.includes('passes executed'));
shaderRender.forEach(l => console.log('  ' + l));

// Check for bypass
console.log('\n⚠️  Bypass/Error Messages:');
const bypass = logs.filter(l => 
  l.includes('bypass') || 
  l.includes('Disabling shaders') ||
  l.includes('black')
);
if (bypass.length > 0) {
  bypass.forEach(l => console.log('  ' + l));
} else {
  console.log('  ✅ No bypass messages');
}

await browser.close();
