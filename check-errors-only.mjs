import puppeteer from 'puppeteer';

async function checkErrors() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      errors.push(text);
    } else if (type === 'warning') {
      warnings.push(text);
    }
  });

  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  try {
    console.log('→ Loading page...');
    await page.goto('http://localhost:8080/404', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('→ Waiting for shaders...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('\n=== ERRORS ===');
    if (errors.length === 0) {
      console.log('✓ No errors found!');
    } else {
      errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
    }

    console.log('\n=== WARNINGS ===');
    if (warnings.length === 0) {
      console.log('✓ No warnings');
    } else {
      warnings.slice(0, 10).forEach((w, i) => console.log(`${i + 1}. ${w}`));
      if (warnings.length > 10) {
        console.log(`... and ${warnings.length - 10} more warnings`);
      }
    }

  } catch (error) {
    console.error('Failed:', error.message);
  } finally {
    await browser.close();
  }
}

checkErrors();
