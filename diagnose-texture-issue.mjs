import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(msg.text()));

  try {
    await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n🔍 TEXTURE BINDING DIAGNOSIS\n');

    // Check for gameTexture registration
    const gameTextureMessages = consoleMessages.filter(m => m.includes('gameTexture'));
    console.log(`📋 gameTexture messages: ${gameTextureMessages.length}`);
    gameTextureMessages.slice(0, 10).forEach(m => console.log(`  ${m}`));

    // Check pass_0 execution
    const pass0Messages = consoleMessages.filter(m => m.includes('pass_0'));
    console.log(`\n📋 pass_0 messages: ${pass0Messages.length > 50 ? '50 most recent' : pass0Messages.length}`);
    pass0Messages.slice(-10).forEach(m => console.log(`  ${m.substring(0, 150)}`));

    // Check for Source texture binding
    const sourceMessages = consoleMessages.filter(m =>
      m.includes('Source') && (m.includes('texture') || m.includes('sampler'))
    );
    console.log(`\n📋 Source texture binding: ${sourceMessages.length}`);
    sourceMessages.slice(-5).forEach(m => console.log(`  ${m.substring(0, 150)}`));

    // Check framebuffer content BEFORE shader
    const beforeMessages = consoleMessages.filter(m => m.includes('BEFORE SHADER'));
    console.log(`\n🎨 Framebuffer content BEFORE shaders:`);
    beforeMessages.slice(-3).forEach(m => console.log(`  ${m}`));

    // Check if AFTER shader shows output
    const afterMessages = consoleMessages.filter(m => m.includes('AFTER') || m.includes('output color'));
    console.log(`\n🎨 Shader output:` );
    afterMessages.slice(-5).forEach(m => console.log(`  ${m.substring(0, 150)}`));

    console.log('\n✅ Diagnosis complete\n');
    console.log('Expected:');
    console.log('  - BEFORE SHADER: rgb(28, 11, 61) = purple background ✓');
    console.log('  - pass_0 input: gameTexture with game content');
    console.log('  - pass_0 output: Should preserve game colors');
    console.log('\nIf output is white, the issue is in pass_0 texture binding');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
