import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  console.log('Loading page...');
  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check for stripping logs
  const strippingLogs = logs.filter(l => l.includes('Stripping') || l.includes('conflicting') || l.includes('lsmooth'));
  console.log('\n🔧 Stripping/conflicting define logs:');
  strippingLogs.forEach(log => console.log('  ', log));

  // Check compilation context around pass_8
  const contextLogs = logs.filter(l => l.includes('Context around') || l.includes('l-value'));
  console.log('\n📍 Error context:');
  contextLogs.forEach(log => console.log('  ', log));

  await browser.close();
})();
