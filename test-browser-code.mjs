import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('PresetParser') || text.includes('Extracted') || text.includes('parameters')) {
      console.log('✅', text);
    }
  });

  console.log('Loading http://localhost:8080/404 in Puppeteer...\n');

  await page.goto('http://localhost:8080/404', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n📋 Please open THIS SAME URL in your browser:');
  console.log('   http://localhost:8080/404');
  console.log('\n   Then search console for: PresetParser');
  console.log('\n   Puppeteer (above) shows the logs work.');
  console.log('   If YOUR browser doesn\'t show them, it has cache issues.\n');

  await new Promise(resolve => setTimeout(resolve, 60000));
  await browser.close();
})();
