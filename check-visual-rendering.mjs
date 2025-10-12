import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleMessages = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
  });

  console.log('⏳ Loading game and waiting for shaders to render...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for audio prompt to clear and game to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Click to dismiss audio prompt if present
  await page.mouse.click(285, 285);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Wait for shader rendering
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check shader status
  const shaderStatus = consoleMessages.filter(msg =>
    msg.includes('shadersEnabled') ||
    msg.includes('MEGA BEZEL') ||
    msg.includes('Preset loaded') ||
    msg.includes('passes executed') ||
    msg.includes('Bypassing') ||
    msg.includes('ERROR') ||
    msg.includes('Failed')
  );

  console.log('\n✅ SHADER STATUS:\n');
  shaderStatus.forEach(msg => console.log(msg));

  // Check for errors
  const errors = consoleMessages.filter(msg => 
    msg.includes('[error]') || 
    msg.includes('ERROR') ||
    msg.includes('Failed') ||
    msg.includes('Bypassing')
  );

  if (errors.length > 0) {
    console.log('\n❌ ERRORS FOUND:\n');
    errors.forEach(msg => console.log(msg));
  } else {
    console.log('\n✅ No errors found!');
  }

  // Get final shader state
  const finalState = consoleMessages.filter(msg => 
    msg.includes('endFrame') && msg.includes('shadersEnabled')
  ).slice(-3);

  console.log('\n📊 FINAL SHADER STATE (last 3 frames):');
  finalState.forEach(msg => console.log(msg));

  await browser.close();
})();
