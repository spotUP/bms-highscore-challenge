import puppeteer from 'puppeteer';

async function getLogs() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('pass_4') || text.includes('PreCRTPass') || text.includes('AfterglowPass') || text.includes('Source')) {
      logs.push(text);
    }
  });

  try {
    console.log('Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('Waiting 8 seconds...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('\n=== PASS_4 LOGS ===\n');
    logs.forEach(log => console.log(log));
    console.log(`\nTotal: ${logs.length} logs`);

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

getLogs();
