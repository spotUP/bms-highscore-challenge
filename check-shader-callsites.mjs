import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Track call sites and rendering
  const callSites = new Map(); // callSite -> { megaBezel: count, passthrough: count }
  let megaBezelFrames = 0;
  let passthroughFrames = 0;
  let conditionFailures = [];

  page.on('console', msg => {
    const text = msg.text();

    // Track MEGA BEZEL rendering
    if (text.includes('[MEGA BEZEL] Rendering with shaders')) {
      const match = text.match(/callSite=(\w+)/);
      const callSite = match ? match[1] : 'UNKNOWN';
      if (!callSites.has(callSite)) {
        callSites.set(callSite, { megaBezel: 0, passthrough: 0 });
      }
      callSites.get(callSite).megaBezel++;
      megaBezelFrames++;
    }

    // Track passthrough rendering
    if (text.includes('[PASSTHROUGH] Using FAKE passthrough')) {
      const match = text.match(/callSite=(\w+)/);
      const callSite = match ? match[1] : 'UNKNOWN';
      if (!callSites.has(callSite)) {
        callSites.set(callSite, { megaBezel: 0, passthrough: 0 });
      }
      callSites.get(callSite).passthrough++;
      passthroughFrames++;
    }

    // Track condition failures (first 50)
    if (text.includes('SHADER CONDITION FAILED') && conditionFailures.length < 50) {
      conditionFailures.push(text);
    }
  });

  console.log('Loading game (skipping audio/start screens)...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('Monitoring for 15 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Check shader state
  const shadersEnabled = await page.evaluate(() => {
    return window.webglShaderWrapper?.shadersEnabled;
  });

  const shadersFailed = await page.evaluate(() => {
    return window.webglShaderWrapper?.shadersFailed;
  });

  const hasRenderer = await page.evaluate(() => {
    return !!window.webglShaderWrapper?.shaderRenderer;
  });

  console.log('='.repeat(80));
  console.log('SHADER CALL SITE ANALYSIS (15 seconds)');
  console.log('='.repeat(80));
  console.log('\nCall Site Breakdown:');
  for (const [callSite, counts] of callSites) {
    console.log(`  ${callSite}:`);
    console.log(`    Mega Bezel renders: ${counts.megaBezel}`);
    console.log(`    Passthrough renders: ${counts.passthrough}`);
  }

  console.log('\nTotal Frames:');
  console.log(`  Mega Bezel (shaders active): ${megaBezelFrames}`);
  console.log(`  Passthrough (shaders bypassed): ${passthroughFrames}`);

  console.log('\nShader State:');
  console.log(`  shadersEnabled: ${shadersEnabled}`);
  console.log(`  shadersFailed: ${shadersFailed}`);
  console.log(`  hasRenderer: ${hasRenderer}`);

  console.log('\nCondition Failures (first 50):');
  if (conditionFailures.length === 0) {
    console.log('  None!');
  } else {
    conditionFailures.forEach(err => console.log(`  ${err}`));
  }

  console.log('='.repeat(80));

  await browser.close();
})();
