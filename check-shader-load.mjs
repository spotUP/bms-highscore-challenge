import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  logs.push(msg.text());
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('\n🔍 Searching for key initialization messages...\n');

const keyPhrases = [
  'SHADER PRESET LOADED',
  'shadersEnabled',
  'Loading shader preset',
  'All 18 passes',
  'All 17 passes',
  'shader pipeline',
  'Failed to load'
];

keyPhrases.forEach(phrase => {
  const matches = logs.filter(l => l.toLowerCase().includes(phrase.toLowerCase()));
  if (matches.length > 0) {
    console.log(`\n📌 "${phrase}" (${matches.length} matches):`);
    matches.forEach(m => console.log(`   ${m}`));
  }
});

// Check final state
const finalState = await page.evaluate(() => {
  const wrapper = window.webglShaderWrapper;
  if (!wrapper) return { error: 'No wrapper' };

  return {
    shadersEnabled: wrapper.shadersEnabled,
    shadersFailed: wrapper.shadersFailed,
    hasRenderer: !!wrapper.shaderRenderer,
    frameCount: wrapper.frameCount
  };
});

console.log('\n📊 Final State:', finalState);

await browser.close();
