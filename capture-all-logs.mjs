import puppeteer from 'puppeteer';

async function captureAll() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting 10 seconds for logs...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n=== ALL CONSOLE LOGS (last 150) ===\n');
    logs.slice(-150).forEach(log => console.log(log));
    console.log(`\nTotal logs captured: ${logs.length}`);

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

captureAll();
