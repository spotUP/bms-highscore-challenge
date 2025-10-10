import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const allMessages = [];
  page.on('console', msg => allMessages.push(msg.text()));

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  const webglErrors = allMessages.filter(m => m.includes('[DirectWebGLCompiler]'));

  console.log('=== DirectWebGLCompiler ERRORS (first 5) ===');
  webglErrors.slice(0, 5).forEach((err, i) => {
    console.log('\n--- Error ' + (i+1) + ' ---');
    console.log(err);
  });

  console.log('\n=== Total DirectWebGLCompiler errors: ' + webglErrors.length + ' ===');

  await browser.close();
})();
