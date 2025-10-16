import puppeteer from 'puppeteer';

async function checkAllDebug() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const allLogs = [];

  page.on('console', msg => {
    const text = msg.text();
    allLogs.push(text);
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for frame 60...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n=== ALL CONSOLE LOGS WITH "DEBUG" ===\n');
    const debugLogs = allLogs.filter(l => l.includes('[DEBUG'));
    if (debugLogs.length > 0) {
      debugLogs.forEach(log => console.log(log));
    } else {
      console.log('No [DEBUG logs found');
    }

    console.log('\n=== ALL CONSOLE LOGS WITH "pass_0 FRAME 60" ===\n');
    const pass0Logs = allLogs.filter(l => l.includes('pass_0 FRAME 60'));
    if (pass0Logs.length > 0) {
      pass0Logs.forEach(log => console.log(log));
    } else {
      console.log('No pass_0 FRAME 60 logs found');
    }

    console.log('\n=== TOTAL LOGS CAPTURED: ' + allLogs.length + ' ===');

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

checkAllDebug();
