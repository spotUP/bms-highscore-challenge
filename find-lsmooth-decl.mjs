import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Find shader source with "const float lsmooth" or "float lsmooth"
  const shaderLog = logs.find(l => l.includes('PARAM_lsmooth') && l.length > 1000);
  if (shaderLog) {
    const lines = shaderLog.split('\n');
    console.log('🔍 Looking for lsmooth declarations...\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('lsmooth') && !line.includes('PARAM_lsmooth') && !line.includes('#define')) {
        console.log(`Line ${i + 1}: ${line}`);
      }
    }
  }

  await browser.close();
})();
