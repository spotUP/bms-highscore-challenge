import puppeteer from 'puppeteer';

async function debugPass0Error() {
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

    // Find pass_0 related logs
    console.log('\n=== PASS_0 ERROR DETAILS ===\n');

    // Find which shader is pass_0
    const loadingLogs = logs.filter(log => log.includes('Loading shader: pass_0') || log.includes('Loading shader: drez-none'));
    if (loadingLogs.length > 0) {
      console.log('Pass 0 shader:');
      loadingLogs.forEach(log => console.log(log));
    }

    // Find compilation error
    const errorLogs = logs.filter(log => log.includes('pass_0') && (log.includes('ERROR') || log.includes('Failed')));
    console.log('\nError logs:');
    errorLogs.forEach(log => console.log(log));

    // Find vertex shader dump for pass_0 if available
    const shaderDump = [];
    let capturing = false;
    for (let i = 0; i < logs.length; i++) {
      if (logs[i].includes('Final compiled vertex shader') || logs[i].includes('PASS_0 VERTEX')) {
        capturing = true;
      }
      if (capturing) {
        shaderDump.push(logs[i]);
        if (shaderDump.length > 50) break; // Capture first 50 lines
      }
    }

    if (shaderDump.length > 0) {
      console.log('\n=== PASS_0 VERTEX SHADER (first 50 lines) ===\n');
      shaderDump.forEach(log => console.log(log));
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugPass0Error();
