import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Navigate to the game
  console.log('⏳ Loading game at http://localhost:8080/404...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for shader initialization
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Print all console messages
  console.log('\n📋 BROWSER CONSOLE MESSAGES:\n');
  consoleMessages.forEach(msg => console.log(msg));

  // Check for shader compilation errors
  const hasErrors = consoleMessages.some(msg =>
    msg.includes('ERROR') ||
    msg.includes('Failed') ||
    msg.includes('compilation')
  );

  if (hasErrors) {
    console.log('\n❌ SHADER COMPILATION ERRORS DETECTED');
  } else {
    console.log('\n✅ NO SHADER COMPILATION ERRORS');
  }

  // Check for successful shader initialization
  const hasSuccess = consoleMessages.some(msg =>
    msg.includes('✅') ||
    msg.includes('passes compiled')
  );

  if (hasSuccess) {
    console.log('✅ SHADERS INITIALIZED SUCCESSFULLY');
  }

  await browser.close();
})();
