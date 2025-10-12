import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Find logs about lsmooth
  const lsmoothLogs = logs.filter(l => l.includes('lsmooth') && !l.includes('PARAM_lsmooth') && !l.includes('assign'));
  console.log('🔍 lsmooth generation logs:');
  lsmoothLogs.forEach(log => console.log('  ', log));

  await browser.close();
})();
