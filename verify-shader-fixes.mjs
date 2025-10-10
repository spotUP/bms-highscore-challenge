import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log('[CONSOLE]', text);
  });

  // Capture errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('[ERROR]', error.message);
  });

  console.log('🔍 Loading shader demo page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for shaders to load
  console.log('⏳ Waiting for shader initialization...');
  await page.waitForFunction(() => {
    return window.performance.now() > 3000;
  }, { timeout: 10000 });

  // Check for shader compilation errors
  const shaderErrors = logs.filter(log =>
    log.includes('ERROR') ||
    log.includes('shader') && log.includes('failed') ||
    log.includes('WebGL') && log.includes('error')
  );

  const globalToVaryingLogs = logs.filter(log =>
    log.includes('Global-to-Varying') ||
    log.includes('GLOBAL') ||
    log.includes('DUAL-STAGE')
  );

  const compilerLogs = logs.filter(log =>
    log.includes('SlangShaderCompiler') ||
    log.includes('Compiling') ||
    log.includes('✅') ||
    log.includes('⚠️')
  );

  console.log('\n=== VERIFICATION RESULTS ===\n');
  console.log(`Total console messages: ${logs.length}`);
  console.log(`Shader errors found: ${shaderErrors.length}`);
  console.log(`Page errors: ${errors.length}`);

  if (shaderErrors.length > 0) {
    console.log('\n⚠️ SHADER ERRORS:');
    shaderErrors.forEach(err => console.log('  -', err));
  }

  if (globalToVaryingLogs.length > 0) {
    console.log('\n📝 GLOBAL-TO-VARYING ACTIVITY:');
    globalToVaryingLogs.forEach(log => console.log('  -', log));
  }

  if (compilerLogs.length > 0) {
    console.log('\n🔧 COMPILER ACTIVITY:');
    compilerLogs.slice(0, 20).forEach(log => console.log('  -', log));
  }

  if (errors.length > 0) {
    console.log('\n❌ PAGE ERRORS:');
    errors.forEach(err => console.log('  -', err));
  }

  if (shaderErrors.length === 0 && errors.length === 0) {
    console.log('\n✅ NO SHADER COMPILATION ERRORS DETECTED!');
    console.log('✅ All architectural fixes appear to be working correctly!');
  } else {
    console.log('\n⚠️ Issues detected - review logs above');
  }

  await browser.close();
})();
