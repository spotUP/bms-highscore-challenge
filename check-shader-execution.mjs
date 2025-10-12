import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Capture console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });

  // Wait for canvas
  await page.waitForSelector('canvas', { timeout: 5000 });

  // Click to start audio (if needed)
  await page.click('body');

  // Wait 3 seconds for shaders to load
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Filter for shader execution logs
  const shaderExecLogs = logs.filter(l =>
    l.includes('[Renderer]') ||
    l.includes('Rendering pass_') ||
    l.includes('beginFrame') ||
    l.includes('endFrame')
  );

  console.log('=== SHADER EXECUTION LOGS (last 50) ===');
  shaderExecLogs.slice(-50).forEach(log => console.log(log));

  // Check if we see pass rendering
  const passRendering = logs.filter(l => l.includes('Rendering pass_'));
  console.log(`\n=== TOTAL PASS RENDERING LOGS: ${passRendering.length} ===`);

  // Check if endFrame is being called
  const endFrameLogs = logs.filter(l => l.includes('endFrame'));
  console.log(`=== TOTAL endFrame LOGS: ${endFrameLogs.length} ===`);

  await browser.close();
})();
