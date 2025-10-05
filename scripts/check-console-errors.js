import puppeteer from 'puppeteer';

async function checkConsoleErrors() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Arrays to store different types of console messages
  const errors = [];
  const warnings = [];
  const logs = [];
  const info = [];

  // Listen to all console messages
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    const location = msg.location();

    const message = {
      type,
      text,
      location: location ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : 'unknown',
      timestamp: new Date().toISOString()
    };

    if (type === 'error') {
      errors.push(message);
    } else if (type === 'warning') {
      warnings.push(message);
    } else if (type === 'log') {
      logs.push(message);
    } else if (type === 'info') {
      info.push(message);
    }
  });

  // Listen to page errors
  page.on('pageerror', error => {
    errors.push({
      type: 'pageerror',
      text: error.toString(),
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  });

  // Listen to response errors
  page.on('response', response => {
    if (!response.ok()) {
      errors.push({
        type: 'response-error',
        text: `Failed to load ${response.url()}: ${response.status()} ${response.statusText()}`,
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log('Navigating to http://localhost:8080/slang-demo...\n');

  try {
    await page.goto('http://localhost:8080/slang-demo', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Page loaded, waiting 5 seconds for initialization...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Print all collected messages
    console.log('='.repeat(80));
    console.log('CONSOLE ERROR REPORT');
    console.log('='.repeat(80));
    console.log(`\nTotal Errors: ${errors.length}`);
    console.log(`Total Warnings: ${warnings.length}`);
    console.log(`Total Logs: ${logs.length}`);
    console.log(`Total Info: ${info.length}\n`);

    if (errors.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('ERRORS:');
      console.log('='.repeat(80));
      errors.forEach((err, idx) => {
        console.log(`\n[ERROR ${idx + 1}]`);
        console.log(`Type: ${err.type}`);
        console.log(`Location: ${err.location || 'N/A'}`);
        console.log(`Message: ${err.text}`);
        if (err.stack) {
          console.log(`Stack: ${err.stack}`);
        }
        console.log('-'.repeat(80));
      });
    }

    if (warnings.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('WARNINGS:');
      console.log('='.repeat(80));
      warnings.forEach((warn, idx) => {
        console.log(`\n[WARNING ${idx + 1}]`);
        console.log(`Location: ${warn.location}`);
        console.log(`Message: ${warn.text}`);
        console.log('-'.repeat(80));
      });
    }

    if (logs.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('LOGS (showing first 20):');
      console.log('='.repeat(80));
      logs.slice(0, 20).forEach((log, idx) => {
        console.log(`\n[LOG ${idx + 1}] ${log.text}`);
      });
      if (logs.length > 20) {
        console.log(`\n... and ${logs.length - 20} more log messages`);
      }
    }

    if (info.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('INFO (showing first 10):');
      console.log('='.repeat(80));
      info.slice(0, 10).forEach((inf, idx) => {
        console.log(`\n[INFO ${idx + 1}] ${inf.text}`);
      });
      if (info.length > 10) {
        console.log(`\n... and ${info.length - 10} more info messages`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('END OF REPORT');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('Error during page load:', error);
  } finally {
    await browser.close();
  }
}

checkConsoleErrors();
