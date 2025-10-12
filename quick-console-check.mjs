import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
  });

  console.log('🔍 Loading page...');
  await page.goto('http://localhost:8080/404', {
    waitUntil: 'networkidle2',
    timeout: 10000
  });

  console.log('⏳ Waiting 3 seconds for shaders to load...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Click to start game (dismiss audio prompt)
  console.log('🎮 Starting game...');
  await page.click('canvas');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check if game is rendering
  const gameState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };

    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'No 2d context' };

    // Sample pixel data
    const imageData = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1);
    const pixel = imageData.data;

    return {
      canvasSize: `${canvas.width}x${canvas.height}`,
      centerPixel: `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3]})`,
      isBlack: pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0
    };
  });

  console.log('🎮 Game state:', gameState);

  // Take screenshot of actual gameplay
  console.log('\n📸 Taking screenshot...');
  await page.screenshot({ path: '/tmp/shader-test.jpg', type: 'jpeg', quality: 50 });
  console.log('✅ Screenshot saved to /tmp/shader-test.jpg');

  // Check for render logs
  console.log('\n🎨 Render execution logs:');
  const execLogs = logs.filter(l =>
    l.includes('executePass') ||
    l.includes('rendering') ||
    l.includes('Pass') && l.includes('executed')
  );

  execLogs.slice(-10).forEach(log => console.log('  ', log));

  // Check for specific key logs
  console.log('\n🔍 Key shader status logs:');
  const keyLogs = logs.filter(l =>
    l.includes('SHADER PRESET LOADED SUCCESSFULLY') ||
    l.includes('shadersEnabled = true') ||
    l.includes('MEGA BEZEL SHADERS NOW ACTIVE') ||
    l.includes('Preset loaded, enabling shaders') ||
    l.includes('Loading shader preset, shadersEnabled') ||
    l.includes('All passes loaded successfully')
  );

  if (keyLogs.length === 0) {
    console.log('❌ NO COMPLETION LOGS FOUND - Shaders never enabled!');
  } else {
    keyLogs.forEach(log => console.log('  ✓', log));
  }

  // Check for successful renders
  console.log('\n✅ Successful render logs:');
  const renderLogs = logs.filter(l =>
    l.includes('✅') && l.includes('Pass') ||
    l.includes('render successful') ||
    l.includes('shaders rendered')
  );

  if (renderLogs.length === 0) {
    console.log('  ❌ NO SUCCESSFUL RENDERS FOUND');
  } else {
    renderLogs.slice(0, 10).forEach(log => console.log('  ', log));
    if (renderLogs.length > 10) {
      console.log(`  ... and ${renderLogs.length - 10} more`);
    }
  }

  // Check what happens after shaders are enabled
  console.log('\n📊 Post-enable status:');
  const postEnableLogs = logs.filter(l =>
    l.includes('SHADER CONDITION') ||
    l.includes('EARLY RETURN')
  );

  const afterEnableIndex = logs.findIndex(l => l.includes('shadersEnabled = true (should be true)'));
  if (afterEnableIndex !== -1) {
    const afterEnableLogs = logs.slice(afterEnableIndex + 1, afterEnableIndex + 20);
    const conditionLogs = afterEnableLogs.filter(l =>
      l.includes('SHADER CONDITION') || l.includes('EARLY RETURN')
    );

    if (conditionLogs.length === 0) {
      console.log('  ✅ No more condition failures after shaders enabled!');
    } else {
      console.log('  ❌ Still seeing failures after enable:');
      conditionLogs.forEach(log => console.log('    ', log));
    }
  }

  await browser.close();
})();
