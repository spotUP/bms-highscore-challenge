import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const errorDetails = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('texture2D') && text.includes('no matching')) {
      // Extract line number
      const lineMatch = text.match(/ERROR: 0:(\d+):/);
      if (lineMatch) {
        errorDetails.push({
          line: parseInt(lineMatch[1]),
          message: text
        });
      }
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  console.log('=== TEXTURE2D ERROR ANALYSIS ===');
  // Sort by line number
  errorDetails.sort((a, b) => a.line - b.line);
  // Show unique line numbers
  const uniqueLines = [...new Set(errorDetails.map(e => e.line))];
  console.log('Unique error lines:', uniqueLines.join(', '));
  console.log('\nFirst few errors:');
  errorDetails.slice(0, 5).forEach(err => {
    console.log('Line', err.line + ':', err.message.substring(0, 120) + '...');
  });

  await browser.close();
})();
