import puppeteer from 'puppeteer';

async function simpleCheck() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for compilation...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find lines with 1490
    const line1490Logs = logs.filter(log => log.includes('1490'));
    console.log(`\nFound ${line1490Logs.length} logs containing '1490':\n`);
    line1490Logs.forEach(log => console.log(log));

    // Also check for total lines log
    const totalLinesLog = logs.find(log => log.includes('total') && log.includes('lines'));
    if (totalLinesLog) {
      console.log('\nTotal lines log:', totalLinesLog);
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

simpleCheck();
