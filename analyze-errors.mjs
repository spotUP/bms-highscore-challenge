import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const allMessages = [];

  page.on('console', msg => {
    allMessages.push(msg.text());
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {
    console.log('Timeout:', e.message);
  }

  const shaderErrors = allMessages.filter(m => 
    m.includes('ERROR:') || 
    m.includes('undeclared identifier') || 
    m.includes('already defined') ||
    m.includes('no matching overloaded function') ||
    m.includes('cannot convert')
  );

  const errorCats = {
    undeclared: [],
    redefined: [],
    noFunction: [],
    cannotConvert: [],
    other: []
  };

  shaderErrors.forEach(err => {
    if (err.includes('undeclared identifier')) {
      const match = err.match(/undeclared identifier '(\w+)'/);
      if (match) errorCats.undeclared.push(match[1]);
    } else if (err.includes('already defined')) {
      const match = err.match(/'(\w+)' : already defined/);
      if (match) errorCats.redefined.push(match[1]);
    } else if (err.includes('no matching overloaded function')) {
      errorCats.noFunction.push(err);
    } else if (err.includes('cannot convert')) {
      errorCats.cannotConvert.push(err);
    } else {
      errorCats.other.push(err);
    }
  });

  console.log('=== ERROR SUMMARY ===');
  console.log('Total shader errors:', shaderErrors.length);
  console.log('Undeclared:', errorCats.undeclared.length);
  console.log('Redefined:', errorCats.redefined.length);
  console.log('No function:', errorCats.noFunction.length);
  console.log('Cannot convert:', errorCats.cannotConvert.length);
  console.log('Other:', errorCats.other.length);

  const undeclaredCounts = {};
  errorCats.undeclared.forEach(v => {
    undeclaredCounts[v] = (undeclaredCounts[v] || 0) + 1;
  });
  console.log('\n=== TOP 20 UNDECLARED VARIABLES ===');
  Object.entries(undeclaredCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([name, count]) => console.log('  ' + count + 'x ' + name));

  const redefinedCounts = {};
  errorCats.redefined.forEach(v => {
    redefinedCounts[v] = (redefinedCounts[v] || 0) + 1;
  });
  console.log('\n=== TOP 20 REDEFINED VARIABLES ===');
  Object.entries(redefinedCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([name, count]) => console.log('  ' + count + 'x ' + name));

  console.log('\n=== SAMPLE NO FUNCTION ERRORS ===');
  for (let i = 0; i < Math.min(5, errorCats.noFunction.length); i++) {
    const err = errorCats.noFunction[i];
    console.log((i+1) + '. ' + err.slice(0, 120));
  }

  console.log('\n=== SAMPLE CANNOT CONVERT ERRORS ===');
  for (let i = 0; i < Math.min(5, errorCats.cannotConvert.length); i++) {
    const err = errorCats.cannotConvert[i];
    console.log((i+1) + '. ' + err.slice(0, 120));
  }

  await browser.close();
})();
