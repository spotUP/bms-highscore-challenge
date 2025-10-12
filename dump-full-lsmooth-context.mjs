import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const shaderSources = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.length > 1000 && text.includes('PARAM_lsmooth')) {
      shaderSources.push(text);
    }
  });

  await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  if (shaderSources.length > 0) {
    const shader = shaderSources[shaderSources.length - 1];
    const lines = shader.split('\n');
    console.log('📝 Searching for ALL lsmooth occurrences in compiled shader:\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('lsmooth')) {
        console.log(`Line ${i + 1}: ${lines[i]}`);
      }
    }
  }

  await browser.close();
})();
