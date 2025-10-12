import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Capture all exceptions
page.on('pageerror', error => {
  console.log('\n❌ PAGE ERROR:');
  console.log('Message:', error.message);
  console.log('Stack:', error.stack);
});

// Capture console errors
page.on('console', async msg => {
  if (msg.type() === 'error') {
    console.log('\n❌ CONSOLE ERROR:');
    console.log(msg.text());

    // Try to get the actual error object
    const args = msg.args();
    for (let i = 0; i < args.length; i++) {
      try {
        const val = await args[i].jsonValue();
        console.log(`  Arg ${i}:`, val);
      } catch (e) {
        // Can't serialize
      }
    }
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('\n✅ Done capturing errors');
await browser.close();
