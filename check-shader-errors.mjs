import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    // Filter for our new error logging and SlangCompiler messages
    if (text.includes('MultiPassRenderer') || text.includes('SlangCompiler') ||
        text.includes('❌') || text.includes('✅') || text.includes('⚠️') ||
        text.includes('Fixed WebGL')) {
      logs.push(`[${msg.type()}] ${text}`);
    }
  });

  page.on('pageerror', error => {
    logs.push(`[PAGE ERROR] ${error.message}`);
  });

  console.log('Loading page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle0',
    timeout: 10000
  }).catch(e => console.log('Navigation timeout (expected)'));

  // Wait for shader compilation
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n=== Shader Compilation Status ===\n');
  logs.forEach(log => console.log(log));

  if (logs.length === 0) {
    console.log('No shader-related logs found. Checking all console output...');

    // Get all logs
    const allLogs = [];
    page.on('console', msg => allLogs.push(`[${msg.type()}] ${msg.text()}`));

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('\n=== All Console Output (last 50 lines) ===\n');
    allLogs.slice(-50).forEach(log => console.log(log));
  }

} catch (error) {
  console.error('Error:', error.message);
} finally {
  await browser.close();
}