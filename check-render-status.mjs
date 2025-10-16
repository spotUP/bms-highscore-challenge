import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(msg.text()));

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n=== RENDER STATUS CHECK ===\n');

    // Check if shaders are ready
    const shadersReady = consoleMessages.filter(m =>
      m.includes('Shader pipeline initialized') ||
      m.includes('Program pass_') && m.includes('compiled successfully')
    );
    console.log(`✅ Shaders compiled: ${shadersReady.length > 0 ? 'YES' : 'NO'}`);

    // Check if game is rendering
    const renderingMessages = consoleMessages.filter(m =>
      m.includes('[GAME LOOP]') ||
      m.includes('Frame ') ||
      m.includes('beginFrame') ||
      m.includes('endFrame')
    );
    console.log(`🎮 Game loop running: ${renderingMessages.length > 10 ? 'YES' : 'NO'} (${renderingMessages.length} messages)`);

    // Check for shader loading/waiting messages
    const loadingMessages = consoleMessages.filter(m =>
      m.includes('Shaders not ready yet') ||
      m.includes('LOADING')
    );
    console.log(`⏳ Waiting for shaders: ${loadingMessages.length} messages`);

    // Check if shaders are enabled
    const shadersEnabled = consoleMessages.filter(m =>
      m.includes('shadersEnabled = true') ||
      m.includes('FULL Mega Bezel')
    );
    console.log(`🎨 Shaders enabled: ${shadersEnabled.length > 0 ? 'YES' : 'NO'}`);

    // Show last shader/render messages
    console.log('\n📋 Last 20 shader/render related messages:');
    const relevant = consoleMessages.filter(m =>
      m.includes('shader') ||
      m.includes('Shader') ||
      m.includes('LOADING') ||
      m.includes('Frame ') ||
      m.includes('compiled')
    );
    relevant.slice(-20).forEach(m => console.log(`  ${m.substring(0, 150)}`));

    // Check canvas state
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { exists: false };

      return {
        exists: true,
        width: canvas.width,
        height: canvas.height,
        style: canvas.style.cssText,
        parent: canvas.parentElement?.tagName
      };
    });

    console.log('\n🖼️  Canvas info:', canvasInfo);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
