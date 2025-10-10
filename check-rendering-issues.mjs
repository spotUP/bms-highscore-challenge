import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const issues = [];

  page.on('console', async msg => {
    const text = msg.text();

    const hasIssueKeyword = text.includes('null') ||
                           text.includes('undefined') ||
                           text.includes('failed') ||
                           text.includes('Failed');

    const isDiagnosticFailure = text.includes('Diagnostics failed');

    if (hasIssueKeyword && !isDiagnosticFailure) {
      console.log('ISSUE:', text);
      issues.push(text);
    }

    if (text.includes('ERROR') || text.includes('error')) {
      console.log('ERROR:', text);
      issues.push(text);
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
    issues.push('PAGE ERROR: ' + error.message);
  });

  console.log('Loading http://localhost:8080/slang-demo...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n=== ISSUES SUMMARY ===');
  console.log('Total issues found:', issues.length);

  if (issues.length === 0) {
    console.log('✅ No rendering issues detected!');
  } else {
    console.log('\n⚠️  Issues found:');
    issues.slice(0, 10).forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.substring(0, 150)}`);
    });
  }

  await browser.close();
})();
