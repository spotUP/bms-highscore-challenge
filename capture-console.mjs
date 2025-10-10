import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  const type = msg.type();
  const text = msg.text();
  logs.push('[' + type + '] ' + text);
});

page.on('pageerror', error => {
  logs.push('[ERROR] ' + error.message);
});

console.log('Loading page...');
try {
  await page.goto('http://localhost:8080/slang-demo', { 
    waitUntil: 'networkidle0',
    timeout: 15000 
  });
  
  console.log('Waiting for logs...');
  await page.waitForTimeout(3000);
  
  console.log('\n=== Browser Console Output ===\n');
  logs.forEach(log => console.log(log));
  
} catch (err) {
  console.error('Error:', err.message);
  console.log('\n=== Logs captured before error ===\n');
  logs.forEach(log => console.log(log));
}

await browser.close();
