import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Track pixel analysis
  const pixelChecks = [];
  const invisibleShaderDetected = [];

  page.on('console', msg => {
    const text = msg.text();

    // Track BEFORE/AFTER pixel analysis
    if (text.includes('[BEFORE SHADER]') || text.includes('[AFTER SHADER]')) {
      pixelChecks.push(text);
    }

    // Track invisible shader bug detection
    if (text.includes('INVISIBLE SHADER BUG DETECTED')) {
      invisibleShaderDetected.push(text);
    }
  });

  console.log('Loading game...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('Monitoring for 10 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('='.repeat(80));
  console.log('INVISIBLE SHADER BUG DETECTION');
  console.log('='.repeat(80));

  console.log('\nPixel Analysis Logs:');
  if (pixelChecks.length === 0) {
    console.log('  No pixel checks performed yet (waiting for frame 60)');
  } else {
    pixelChecks.forEach(log => console.log(`  ${log}`));
  }

  console.log('\n🚨 Invisible Shader Bug:');
  if (invisibleShaderDetected.length === 0) {
    console.log('  ✅ NOT DETECTED - Shaders are transforming pixels correctly!');
  } else {
    console.log('  ❌ DETECTED! Shaders running but not transforming:');
    invisibleShaderDetected.forEach(log => console.log(`  ${log}`));
  }

  console.log('='.repeat(80));

  await browser.close();
})();
