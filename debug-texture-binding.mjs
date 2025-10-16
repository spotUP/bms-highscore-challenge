import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(msg.text()));

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n=== TEXTURE BINDING DEBUG ===\n');

    // Check for texture-related errors
    const textureErrors = consoleMessages.filter(m =>
      m.toLowerCase().includes('texture') &&
      (m.includes('error') || m.includes('failed') || m.includes('null') || m.includes('undefined'))
    );

    if (textureErrors.length > 0) {
      console.log(`❌ ${textureErrors.length} TEXTURE ERRORS:`);
      textureErrors.forEach(e => console.log(`  ${e.substring(0, 200)}`));
    } else {
      console.log('✅ No explicit texture errors');
    }

    // Check framebuffer messages
    const framebufferMessages = consoleMessages.filter(m =>
      m.includes('framebuffer') || m.includes('Framebuffer') || m.includes('FB=')
    );
    console.log(`\n📋 ${framebufferMessages.length} framebuffer messages`);
    console.log('Last 10 framebuffer messages:');
    framebufferMessages.slice(-10).forEach(m => console.log(`  ${m.substring(0, 150)}`));

    // Check for shader rendering messages
    const shaderRenderMessages = consoleMessages.filter(m =>
      m.includes('applyShaders') ||
      m.includes('renderWithShaders') ||
      m.includes('Applying shader pipeline')
    );
    console.log(`\n🎨 ${shaderRenderMessages.length} shader render messages`);
    shaderRenderMessages.slice(-5).forEach(m => console.log(`  ${m.substring(0, 150)}`));

    // Check fillRect messages (game rendering)
    const fillRectMessages = consoleMessages.filter(m => m.includes('fillRect'));
    console.log(`\n🎮 ${fillRectMessages.length} fillRect messages (game draw calls)`);

    // Check for render pipeline messages
    const renderMessages = consoleMessages.filter(m =>
      m.includes('[WebGL2D.fillRect') ||
      m.includes('beginFrame') ||
      m.includes('endFrame')
    );
    console.log(`\n📐 Last 10 render messages:`);
    renderMessages.slice(-10).forEach(m => console.log(`  ${m.substring(0, 150)}`));

    // Check if shaders are getting source texture
    const sourceMessages = consoleMessages.filter(m =>
      m.includes('Source texture') ||
      m.includes('Input texture') ||
      m.includes('pass_0') && m.includes('texture')
    );
    console.log(`\n🖼️  ${sourceMessages.length} source texture messages`);
    sourceMessages.slice(-5).forEach(m => console.log(`  ${m.substring(0, 150)}`));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
