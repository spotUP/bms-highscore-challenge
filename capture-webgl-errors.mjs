import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

const errors = [];

page.on('console', msg => {
  const text = msg.text();
  // Capture DirectWebGLCompiler messages
  if (text.includes('DirectWebGLCompiler') ||
      text.includes('compilation error') ||
      text.includes('ERROR:')) {
    errors.push(text);
  }
});

page.on('pageerror', error => {
  errors.push(`PAGE ERROR: ${error.message}`);
});

await page.goto('http://localhost:8080/slang-demo', {
  waitUntil: 'networkidle0',
  timeout: 10000
}).catch(() => {});

// Wait for compilation attempts
await new Promise(r => setTimeout(r, 3000));

console.log('=== WebGL Compilation Errors ===');
errors.forEach(err => console.log(err));

if (errors.length === 0) {
  console.log('No DirectWebGLCompiler errors captured. Checking all console output...');

  // Get all console messages
  const allLogs = [];
  page.removeAllListeners('console');
  page.on('console', msg => allLogs.push(msg.text()));

  await page.reload();
  await new Promise(r => setTimeout(r, 3000));

  const relevantLogs = allLogs.filter(log =>
    log.includes('shader') ||
    log.includes('Shader') ||
    log.includes('WebGL') ||
    log.includes('ERROR') ||
    log.includes('compilation')
  );

  console.log('\n=== Shader-related logs ===');
  relevantLogs.slice(0, 50).forEach(log => console.log(log));
}

await browser.close();