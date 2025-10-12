import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Track specific logs
  let presetLoaded = false;
  let presetParserLogs = [];
  let shaderEnabled = false;
  let parametersParsed = false;

  page.on('console', msg => {
    const text = msg.text();

    // Track preset loading
    if (text.includes('SHADER PRESET LOADED SUCCESSFULLY')) {
      presetLoaded = true;
      console.log('✅ Preset loaded');
    }

    // Track PresetParser logs
    if (text.includes('[PresetParser]')) {
      presetParserLogs.push(text);
      console.log('📝', text);
    }

    // Track shader enabling
    if (text.includes('Preset loaded, enabling shaders NOW')) {
      shaderEnabled = true;
      console.log('✅ Shaders enabled');
    }

    // Track parameter extraction
    if (text.includes('Extracted') && text.includes('parameters')) {
      parametersParsed = true;
      console.log('📊', text);
    }

    // Show shader condition failures
    if (text.includes('SHADER CONDITION FAILED')) {
      console.log('❌', text);
    }

    // Show MEGA BEZEL rendering
    if (text.includes('MEGA BEZEL') && text.includes('Rendering with shaders')) {
      console.log('🎨', text);
    }
  });

  console.log('Loading game...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  console.log('\nMonitoring for 5 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n=== SUMMARY ===');
  console.log(`Preset Loaded: ${presetLoaded ? '✅' : '❌'}`);
  console.log(`Shaders Enabled: ${shaderEnabled ? '✅' : '❌'}`);
  console.log(`Parameters Parsed: ${parametersParsed ? '✅' : '❌'}`);
  console.log(`PresetParser Logs: ${presetParserLogs.length}`);

  if (presetParserLogs.length === 0) {
    console.log('\n⚠️ NO PRESET PARSER LOGS! Parser code not executing.');
  } else {
    console.log('\n📋 PresetParser Logs:');
    presetParserLogs.forEach(log => console.log(`  ${log}`));
  }

  await browser.close();
})();
