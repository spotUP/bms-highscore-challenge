import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Collect ALL console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
  });

  // Navigate to the game
  console.log('⏳ Loading game...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for shaders to fail (after 2-3 seconds) + extra time
  console.log('⏳ Waiting 10 seconds for shader failure during gameplay...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Filter for shader-related errors
  const shaderMessages = consoleMessages.filter(msg =>
    msg.includes('shader') ||
    msg.includes('WebGL') ||
    msg.includes('Failed') ||
    msg.includes('error') ||
    msg.includes('Bypassing') ||
    msg.includes('endFrame') ||
    msg.includes('render') ||
    msg.includes('ERROR') ||
    msg.includes('Warning') ||
    msg.includes('texture') ||
    msg.includes('framebuffer')
  );

  console.log('\n🔍 ALL SHADER-RELATED MESSAGES:\n');
  shaderMessages.forEach(msg => console.log(msg));

  // Look specifically for the bypass message
  const bypassMessage = consoleMessages.find(msg => msg.includes('Bypassing shaders'));
  if (bypassMessage) {
    console.log('\n❌ FOUND BYPASS MESSAGE:');
    console.log(bypassMessage);
  } else {
    console.log('\n⚠️ No "Bypassing shaders" message found');
  }

  // Show last 30 messages for context
  console.log('\n📋 LAST 30 CONSOLE MESSAGES:');
  consoleMessages.slice(-30).forEach(msg => console.log(msg));

  await browser.close();
})();
