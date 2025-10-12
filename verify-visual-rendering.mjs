import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  let shaderErrors = [];
  let shaderSuccess = [];

  page.on('console', msg => {
    const text = msg.text();

    // Track shader compilation
    if (text.includes('compiled successfully')) {
      shaderSuccess.push(text);
    }
    if (text.includes('Failed to compile') || text.includes('compilation failed')) {
      shaderErrors.push(text);
    }

    // Log shader execution
    if (text.includes('Executing pass')) {
      console.log(`✅ ${text}`);
    }

    // Log any errors
    if (msg.type() === 'error') {
      console.log(`❌ [ERROR] ${text}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`❌ [PAGE ERROR] ${error.message}`);
    shaderErrors.push(error.message);
  });

  console.log('🎮 Opening http://localhost:8080/404');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  console.log('⏳ Waiting 15 seconds for shaders to load and render...');
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 15000)));

  console.log('\n📊 SHADER STATUS:');
  console.log(`✅ Successful compilations: ${shaderSuccess.length}`);
  console.log(`❌ Failed compilations: ${shaderErrors.length}`);

  if (shaderErrors.length > 0) {
    console.log('\n❌ ERRORS FOUND:');
    shaderErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err.substring(0, 200)}`));
  } else {
    console.log('\n✅ All shaders loaded successfully! Visual CRT effects should be visible.');
  }

  console.log('\n🖼️  Browser window will stay open for visual inspection.');
  console.log('👀 You should see:');
  console.log('   - Scanlines (horizontal lines across the screen)');
  console.log('   - Subtle screen curvature');
  console.log('   - Bloom/glow around bright elements');
  console.log('   - Enhanced color grading');
  console.log('\nPress Ctrl+C to close when done inspecting.');

  // Keep alive
  await new Promise(() => {});
})();
