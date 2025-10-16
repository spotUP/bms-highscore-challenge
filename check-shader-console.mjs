import puppeteer from 'puppeteer';

async function checkConsole() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const messages = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    messages.push({ type, text });
    console.log(`[${type.toUpperCase()}] ${text}`);
  });

  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
    messages.push({ type: 'pageerror', text: error.message });
  });

  try {
    console.log('→ Navigating to http://localhost:8080/404');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('→ Waiting 5 seconds for shaders to compile...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for errors
    const errors = messages.filter(m => m.type === 'error' || m.type === 'pageerror');
    const warnings = messages.filter(m => m.type === 'warning');

    console.log('\n=== SUMMARY ===');
    console.log(`Total messages: ${messages.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach((e, i) => console.log(`${i + 1}. ${e.text}`));
    }

  } catch (error) {
    console.error('Failed to check console:', error.message);
  } finally {
    await browser.close();
  }
}

checkConsole();
