import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();

const errors = [];
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('ERROR:') || text.includes('SlangCompiler')) {
    errors.push(text);
  }
});

try {
  await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle2', timeout: 10000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log(`\nTotal shader-related messages: ${errors.length}\n`);

  // Count ERROR lines
  const errorLines = errors.filter(e => e.includes('ERROR:')).length;
  console.log(`ERROR lines found: ${errorLines}\n`);

  // Show first 30 errors
  console.log('First 30 errors:');
  errors.slice(0, 30).forEach(e => console.log(e));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
