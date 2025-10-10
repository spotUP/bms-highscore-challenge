import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const vertexErrors = [];
  const fragmentErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('shader compilation error')) {
      if (text.includes('Vertex')) {
        vertexErrors.push(text);
      } else if (text.includes('Fragment')) {
        fragmentErrors.push(text);
      }
    }
  });

  try {
    await page.goto('http://localhost:8080/slang-demo', { timeout: 15000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 12000));
  } catch (e) {}

  console.log('=== FIRST VERTEX ERRORS ===');
  vertexErrors.slice(0, 3).forEach(err => {
    console.log(err.substring(0, 200));
    console.log('---');
  });
  
  console.log('\n=== FIRST FRAGMENT ERRORS ===');
  fragmentErrors.slice(0, 3).forEach(err => {
    console.log(err.substring(0, 200));
    console.log('---');
  });

  await browser.close();
})();
