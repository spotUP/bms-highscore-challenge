import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 3000));

// Check key details
const result = await page.evaluate(() => {
  const wrapper = window.webglShaderWrapper;
  if (!wrapper?.multiPassRenderer) {
    return { error: 'No renderer' };
  }

  const renderer = wrapper.multiPassRenderer;
  const passes = renderer.passes || [];

  return {
    totalPasses: passes.length,
    allCompiled: passes.every(p => p.compiled),
    hasGlowPass: renderer.aliasToTextureId?.has('GlowPass'),
    hasBloomPass: renderer.aliasToTextureId?.has('BloomPass'),
    hasLinearizePass: renderer.aliasToTextureId?.has('LinearizePass'),
  };
});

console.log('\n📊 Result:', JSON.stringify(result, null, 2));

// Check for key logs
const important = logs.filter(l =>
  l.includes('All') && l.includes('passes') ||
  l.includes('GlowPass') ||
  l.includes('BloomPass') ||
  l.includes('CRT')
);

console.log('\n📝 Key Logs:');
important.slice(-10).forEach(log => console.log('  ', log));

await browser.close();
