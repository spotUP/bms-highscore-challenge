import puppeteer from 'puppeteer';

console.log('🔍 Checking Pass 2 error...\n');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

let pass2Error = null;

page.on('console', msg => {
  const text = msg.text();

  // Capture any error related to pass_2
  if (text.includes('pass_2') || text.includes('fetch-drez-output')) {
    console.log('[PASS2]', text);
  }

  // Look for the actual error
  if (text.includes('Error loading shader pass pass_2')) {
    pass2Error = text;
  }
});

page.on('pageerror', error => {
  console.log('[PAGE ERROR]', error.message);
  if (error.message.includes('pass_2') || error.message.includes('fetch')) {
    pass2Error = error.message;
  }
});

await page.goto('http://localhost:8080/404', { waitUntil: 'networkidle0' });
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('\n' + '='.repeat(70));
if (pass2Error) {
  console.log('❌ Pass 2 Error Found:', pass2Error);
} else {
  console.log('⚠️  No specific error captured - check logs above');
}
console.log('='.repeat(70));

await browser.close();
