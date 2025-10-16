import puppeteer from 'puppeteer';

async function checkShaderStatus() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const errors = [];
  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.toLowerCase().includes('error')) {
      errors.push(text);
    }
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for shaders to compile...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n=== CONSOLE ERRORS ===\n');
    if (errors.length > 0) {
      errors.forEach(err => console.log(err));
    } else {
      console.log('✅ No errors found!');
    }

    // Check for pass output logs
    const passOutputs = logs.filter(log => log.includes('[PASS OUTPUT]'));
    console.log('\n=== PASS OUTPUTS ===\n');
    if (passOutputs.length > 0) {
      passOutputs.forEach(log => console.log(log));
    } else {
      console.log('❌ No pass output logs found');
    }

    // Check for layout qualifier preservation
    const layoutLogs = logs.filter(log => log.includes('layout(location') || log.includes('Preserved layout'));
    console.log('\n=== LAYOUT QUALIFIER LOGS ===\n');
    if (layoutLogs.length > 0) {
      layoutLogs.slice(0, 5).forEach(log => console.log(log));
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

checkShaderStatus();
