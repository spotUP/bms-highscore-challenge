import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-cache']
  });

  const page = await browser.newPage();

  // Clear cache
  await page.setCacheEnabled(false);

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Navigate to the game
  console.log('⏳ Loading game at http://localhost:8080/404 (cache disabled)...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for shader initialization
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Check for errors
  const errors = consoleMessages.filter(msg => msg.includes('ERROR') || msg.includes('Failed to compile'));

  if (errors.length > 0) {
    console.log('\n❌ SHADER COMPILATION ERRORS:\n');
    errors.forEach(err => console.log(err));
  } else {
    console.log('\n✅ NO COMPILATION ERRORS');
  }

  // Check for success
  const success = consoleMessages.filter(msg => msg.includes('✅') && msg.includes('compiled'));
  if (success.length > 0) {
    console.log('\n🎉 SUCCESSFUL COMPILATIONS:\n');
    success.forEach(s => console.log(s));
  }

  await browser.close();
})();
