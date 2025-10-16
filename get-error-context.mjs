import puppeteer from 'puppeteer';

async function getErrorContext() {
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

    console.log('→ Waiting for compilation...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find error context
    console.log('\n=== ERROR CONTEXT ===\n');

    let foundContext = false;
    for (let i = 0; i < logs.length; i++) {
      if (logs[i].includes('Context around line')) {
        foundContext = true;
        console.log(logs[i]);
        // Print next 15 lines
        for (let j = 1; j <= 15 && (i + j) < logs.length; j++) {
          console.log(logs[i + j]);
        }
        break;
      }
    }

    if (!foundContext) {
      console.log('❌ No error context found in logs');

      // Show all error-related logs
      const errorLogs = logs.filter(log =>
        log.includes('ERROR') ||
        log.includes('Failed') ||
        log.includes('>>>'));

      console.log('\nAll error logs:');
      errorLogs.forEach(log => console.log(log));
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

getErrorContext();
