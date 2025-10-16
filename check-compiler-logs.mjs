import puppeteer from 'puppeteer';

async function checkCompilerLogs() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('SlangCompiler') || text.includes('layout')) {
      logs.push(text);
    }
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('→ Waiting for compilation...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n=== COMPILER LOGS ===\n');
    logs.forEach(log => console.log(log));
    console.log(`\nTotal: ${logs.length} logs`);

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

checkCompilerLogs();
