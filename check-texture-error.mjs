import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes("'texture' : no matching")) {
      // Extract the full error
      const match = text.match(/ERROR: 0:(\d+): '(texture\w*)'.*$/);
      if (match) {
        errors.push({
          line: parseInt(match[1]),
          func: match[2],
          full: text.substring(text.indexOf('ERROR'))
        });
      }
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  console.log('=== TEXTURE ERROR DETAILS ===');
  console.log('Total texture errors:', errors.length);
  
  // Show first few unique errors
  const uniqueErrors = {};
  errors.forEach(err => {
    const key = err.func + ':' + err.line;
    if (!uniqueErrors[key]) {
      uniqueErrors[key] = err;
    }
  });
  
  console.log('\nUnique error locations:');
  Object.values(uniqueErrors).slice(0, 5).forEach(err => {
    console.log('Line', err.line + ':', err.full.substring(0, 150));
  });

  await browser.close();
})();
