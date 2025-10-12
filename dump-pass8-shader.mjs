import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let vertexShader = '';
  page.on('console', msg => {
    const text = msg.text();
    // Capture the vertex shader source
    if (text.includes('uniform float PARAM_lsmooth')) {
      const lines = text.split('\n');
      const lsmoothIndex = lines.findIndex(l => l.includes('PARAM_lsmooth'));
      if (lsmoothIndex >= 0) {
        // Get 50 lines around PARAM_lsmooth
        const start = Math.max(0, lsmoothIndex - 10);
        const end = Math.min(lines.length, lsmoothIndex + 40);
        vertexShader = lines.slice(start, end).join('\n');
      }
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  if (vertexShader) {
    console.log('📝 Compiled vertex shader around PARAM_lsmooth:');
    console.log(vertexShader);
  } else {
    console.log('❌ Could not capture shader source');
  }

  await browser.close();
})();
