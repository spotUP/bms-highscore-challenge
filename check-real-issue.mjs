import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Capture ALL console messages
  const allLogs = [];
  page.on('console', msg => {
    allLogs.push(msg.text());
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
  await page.waitForSelector('canvas', { timeout: 5000 });

  // Click and press space to start
  await page.click('body');
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.keyboard.press('Space');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Filter logs
  const beginFrameLogs = allLogs.filter(l => l.includes('beginFrame CALL') || l.includes('BEGIN FRAME'));
  const fillRectLogs = allLogs.filter(l => l.includes('fillRect #'));
  const shadersFailedLogs = allLogs.filter(l => l.includes('shadersFailed'));
  const wrapperLogs = allLogs.filter(l => l.includes('WebGL2DWithShaders'));

  console.log('\n=== DEBUG ANALYSIS ===');
  console.log(`beginFrame CALL logs: ${beginFrameLogs.filter(l => l.includes('beginFrame CALL')).length}`);
  console.log(`BEGIN FRAME logs (from game): ${beginFrameLogs.filter(l => l.includes('BEGIN FRAME')).length}`);
  console.log(`fillRect logs: ${fillRectLogs.length}`);

  if (beginFrameLogs.length > 0) {
    console.log('\nFirst 5 beginFrame logs:');
    beginFrameLogs.slice(0, 5).forEach(l => console.log('  ', l));
  }

  if (fillRectLogs.length > 0) {
    console.log('\nFirst 5 fillRect logs:');
    fillRectLogs.slice(0, 5).forEach(l => console.log('  ', l));
  }

  // Check wrapper initialization
  console.log('\n=== WRAPPER INITIALIZATION ===');
  wrapperLogs.slice(0, 10).forEach(l => console.log('  ', l));

  // Check for shadersFailed
  const failedLog = allLogs.find(l => l.includes('shadersEnabled') && l.includes('true'));
  console.log('\n=== SHADERS ENABLED ===');
  console.log(failedLog || 'NOT FOUND');

  await browser.close();
})();
