import puppeteer from 'puppeteer';

const url = 'http://localhost:8080/slang-demo';
console.log(`Checking console logs at: ${url}`);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Capture console messages
const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
  console.log(`[CONSOLE] ${text}`);
});

// Capture errors
page.on('pageerror', err => {
  console.log(`[ERROR] ${err.message}`);
});

try {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  console.log('Page loaded, waiting for shader compilation...');
  await page.waitForTimeout(5000);

  // Check for specific logs
  const hasGlobalConversion = logs.some(log => log.includes('GlobalToVaryingConverter') || log.includes('global-to-varying'));
  const hasShaderErrors = logs.some(log => log.includes('undeclared identifier') || log.includes('ERROR:'));
  const hasCompilationSuccess = logs.some(log => log.includes('Compilation completed'));

  console.log('\n=== SUMMARY ===');
  console.log(`Global-to-varying conversion: ${hasGlobalConversion ? '✅ YES' : '❌ NO'}`);
  console.log(`Shader errors: ${hasShaderErrors ? '❌ YES' : '✅ NO'}`);
  console.log(`Compilation success: ${hasCompilationSuccess ? '✅ YES' : '❌ NO'}`);
  console.log(`Total console messages: ${logs.length}`);

  if (hasShaderErrors) {
    console.log('\n=== SHADER ERRORS ===');
    logs.filter(log => log.includes('undeclared identifier') || log.includes('ERROR:')).forEach(log => {
      console.log(log);
    });
  }

} catch (err) {
  console.error('Error loading page:', err.message);
} finally {
  await browser.close();
}
